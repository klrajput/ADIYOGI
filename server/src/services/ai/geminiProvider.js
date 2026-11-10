'use strict';

/**
 * Google Gemini provider (server-side only), docs/ARCHITECTURE.md §7.
 *
 * Responsibilities:
 *  - translate the provider-neutral `{messages, systemPrompt}` payload into the
 *    Gemini content format and issue one request;
 *  - enforce a hard timeout (`AI_TIMEOUT_MS`) that also aborts the HTTP request;
 *  - retry exactly once with jitter on timeouts and 5xx responses;
 *  - reject with typed `AiProviderError`s (`AI_TIMEOUT`, `AI_RATE_LIMITED`,
 *    `AI_PROVIDER_ERROR`) that never contain the prompt, user text or API key.
 *
 * It never fabricates text: an empty/blocked response is an error.
 */
const { GoogleGenerativeAI } = require('@google/generative-ai');
const logger = require('../../config/logger');
const { AI_ERROR_CODES, AiProviderError } = require('./provider');

const PROVIDER_NAME = 'gemini';
const MAX_ATTEMPTS = 2;
const RETRY_BASE_MS = 150;
const RETRY_JITTER_MS = 250;

/**
 * @param {Array<{role:'user'|'assistant',content:string}>} messages
 * @returns {Array<{role:'user'|'model',parts:Array<{text:string}>}>}
 */
function toGeminiContents(messages) {
  return messages.map((message) => ({
    role: message.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: String(message.content) }],
  }));
}

/**
 * @param {*} usageMetadata Gemini `usageMetadata`
 * @returns {{promptTokens:number,completionTokens:number,totalTokens:number}}
 */
function mapUsage(usageMetadata) {
  const meta = usageMetadata && typeof usageMetadata === 'object' ? usageMetadata : {};
  return {
    promptTokens: Number(meta.promptTokenCount) || 0,
    completionTokens: Number(meta.candidatesTokenCount) || 0,
    totalTokens: Number(meta.totalTokenCount) || 0,
  };
}

/**
 * Classify a vendor/network failure into a typed error.
 * Messages are deliberately generic: the vendor message can contain the
 * request URL (and therefore the key) or prompt fragments.
 *
 * @param {*} error
 * @param {{timedOut:boolean, externallyAborted:boolean}} state
 * @returns {AiProviderError}
 */
function classifyError(error, state) {
  if (error instanceof AiProviderError) return error;

  const statusCode =
    (error && (error.status || error.statusCode || (error.response && error.response.status))) ||
    undefined;
  const rawMessage = String((error && error.message) || '');

  if (state.externallyAborted) {
    return new AiProviderError(AI_ERROR_CODES.TIMEOUT, 'The AI request was cancelled', {
      retryable: false,
    });
  }
  if (state.timedOut || (error && error.name === 'AbortError') || /tim(ed)? ?out/i.test(rawMessage)) {
    return new AiProviderError(AI_ERROR_CODES.TIMEOUT, 'The AI provider timed out', {
      retryable: true,
    });
  }
  if (statusCode === 429 || /429|RESOURCE_EXHAUSTED|quota|rate.?limit/i.test(rawMessage)) {
    return new AiProviderError(
      AI_ERROR_CODES.RATE_LIMITED,
      'The AI provider is rate limited right now',
      { retryable: false, statusCode: 429 }
    );
  }
  if (
    (typeof statusCode === 'number' && statusCode >= 500) ||
    /(^|\D)5\d\d(\D|$)|ECONNRESET|ECONNREFUSED|ENOTFOUND|EAI_AGAIN|fetch failed|network/i.test(
      rawMessage
    )
  ) {
    return new AiProviderError(AI_ERROR_CODES.PROVIDER_ERROR, 'The AI provider is unavailable', {
      retryable: true,
      statusCode,
    });
  }
  return new AiProviderError(AI_ERROR_CODES.PROVIDER_ERROR, 'The AI provider could not answer', {
    retryable: false,
    statusCode,
  });
}

/** @param {number} attempt 1-based attempt number */
function retryDelayMs(attempt) {
  return RETRY_BASE_MS * attempt + Math.floor(Math.random() * RETRY_JITTER_MS);
}

/** @param {number} ms */
function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Create the Gemini provider.
 *
 * @param {{
 *  apiKey?: string,
 *  model?: string,
 *  timeoutMs?: number,
 *  clientFactory?: (apiKey:string) => { getGenerativeModel: Function },
 *  retry?: boolean
 * }} options
 * @returns {{name:string, model:string, isConfigured:Function, generate:Function}}
 */
function createGeminiProvider({
  apiKey = '',
  model = 'gemini-2.0-flash',
  timeoutMs = 20000,
  clientFactory,
  retry = true,
} = {}) {
  let client = null;

  /** @returns {boolean} */
  function isConfigured() {
    return Boolean(apiKey) && Boolean(model);
  }

  /**
   * @param {string} systemPrompt
   * @returns {object} Gemini generative model
   */
  function getModel(systemPrompt) {
    if (!client) {
      client = clientFactory ? clientFactory(apiKey) : new GoogleGenerativeAI(apiKey);
    }
    return client.getGenerativeModel({ model, systemInstruction: systemPrompt });
  }

  /**
   * One request with timeout + abort bridging. Never fabricates text.
   *
   * @param {object} modelInstance
   * @param {Array<object>} contents
   * @param {{signal?: AbortSignal}} [options]
   * @returns {Promise<{text:string,usage:object}>}
   */
  async function requestOnce(modelInstance, contents, { signal } = {}) {
    const controller = new AbortController();
    let timedOut = false;
    let rejectOnTimeout = null;
    // The timer both aborts the SDK request and rejects our own race, so a client
    // that ignores AbortSignal still cannot hang the request.
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
      if (rejectOnTimeout) {
        rejectOnTimeout(
          new AiProviderError(AI_ERROR_CODES.TIMEOUT, 'The AI provider timed out', {
            retryable: true,
          })
        );
      }
    }, timeoutMs);

    const onExternalAbort = () => controller.abort();
    if (signal) {
      if (signal.aborted) {
        clearTimeout(timer);
        throw new AiProviderError(AI_ERROR_CODES.TIMEOUT, 'The AI request was cancelled', {
          retryable: false,
        });
      }
      if (typeof signal.addEventListener === 'function') {
        signal.addEventListener('abort', onExternalAbort, { once: true });
      }
    }

    try {
      const timeoutRace = new Promise((_resolve, reject) => {
        rejectOnTimeout = reject;
      });
      const result = await Promise.race([
        modelInstance.generateContent(
          { contents },
          { signal: controller.signal, timeout: timeoutMs }
        ),
        timeoutRace,
      ]);
      const response = result && result.response;
      const text = typeof response.text === 'function' ? String(response.text() || '').trim() : '';
      if (!text) {
        throw new AiProviderError(
          AI_ERROR_CODES.PROVIDER_ERROR,
          'The AI provider returned an empty answer'
        );
      }
      return { text, usage: mapUsage(response.usageMetadata) };
    } catch (error) {
      throw classifyError(error, {
        timedOut,
        externallyAborted: Boolean(signal && signal.aborted),
      });
    } finally {
      clearTimeout(timer);
      if (signal && typeof signal.removeEventListener === 'function') {
        signal.removeEventListener('abort', onExternalAbort);
      }
    }
  }

  /**
   * @param {{messages:Array<{role:string,content:string}>, systemPrompt:string, signal?:AbortSignal}} request
   * @returns {Promise<{text:string,usage:object}>}
   */
  async function generate({ messages = [], systemPrompt = '', signal } = {}) {
    if (!isConfigured()) {
      throw new AiProviderError(
        AI_ERROR_CODES.PROVIDER_ERROR,
        'The AI provider is not configured on this server'
      );
    }
    if (!Array.isArray(messages) || messages.length === 0) {
      throw new AiProviderError(AI_ERROR_CODES.PROVIDER_ERROR, 'The AI provider got no messages');
    }

    const contents = toGeminiContents(messages);
    const maxAttempts = retry ? MAX_ATTEMPTS : 1;
    let lastError = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        return await requestOnce(getModel(systemPrompt), contents, { signal });
      } catch (error) {
        const providerError = classifyError(error, { timedOut: false, externallyAborted: false });
        lastError = providerError;
        logger.warn('ai provider request failed', {
          provider: PROVIDER_NAME,
          model,
          attempt,
          code: providerError.code,
          statusCode: providerError.statusCode,
        });
        const shouldRetry = providerError.retryable && attempt < maxAttempts;
        if (!shouldRetry) throw providerError;
        await sleep(retryDelayMs(attempt));
      }
    }

    throw lastError;
  }

  return { name: PROVIDER_NAME, model, isConfigured, generate };
}

module.exports = { createGeminiProvider, PROVIDER_NAME };
