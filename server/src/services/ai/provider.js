'use strict';

/**
 * AI provider registry (docs/ARCHITECTURE.md §7).
 *
 * The provider interface every implementation must satisfy:
 *
 *   {
 *     name: string,                     // 'gemini'
 *     model: string,                    // env.ai.model
 *     isConfigured(): boolean,
 *     async generate({ messages, systemPrompt, signal }) -> { text, usage }
 *   }
 *
 * `messages` is `[{ role: 'user'|'assistant', content: string }]` ordered oldest → newest;
 * `systemPrompt` is trusted server-side text; `signal` is an optional AbortSignal.
 * `generate` MUST either resolve with a non-empty `text` or reject with an
 * `AiProviderError` — it must never resolve canned/generated placeholder text.
 *
 * The provider is server-only. No AI call is ever made from the browser, and the
 * API key is never logged or returned to a client.
 */
const env = require('../../config/env');

/** Machine-readable provider failure codes surfaced as 503 AI_UNAVAILABLE. */
const AI_ERROR_CODES = Object.freeze({
  TIMEOUT: 'AI_TIMEOUT',
  RATE_LIMITED: 'AI_RATE_LIMITED',
  PROVIDER_ERROR: 'AI_PROVIDER_ERROR',
});

/**
 * Typed provider failure. Messages are fixed strings — never include the prompt,
 * user text or API key. Callers may expose `code` to clients, never the cause.
 */
class AiProviderError extends Error {
  /**
   * @param {string} code one of AI_ERROR_CODES
   * @param {string} message fixed, user-safe message
   * @param {{retryable?:boolean,statusCode?:number,retryAfterMs?:number}} [meta]
   */
  constructor(code, message, meta = {}) {
    super(message);
    this.name = 'AiProviderError';
    this.code = code;
    this.retryable = Boolean(meta.retryable);
    if (meta.statusCode !== undefined) this.statusCode = meta.statusCode;
    if (meta.retryAfterMs !== undefined) this.retryAfterMs = meta.retryAfterMs;
    Error.captureStackTrace(this, AiProviderError);
  }
}

/**
 * @param {*} error
 * @returns {boolean} true for typed provider errors that are safe to retry
 */
function isAiProviderError(error) {
  return error instanceof AiProviderError;
}

/** Test-only override installed by `setProviderForTesting`. */
let testProvider = null;
/** Lazily-created singleton for the configured real provider. */
let configuredProvider = null;

/**
 * The configured provider, or `null` when AI is not configured on this deployment.
 * Callers must treat `null` as "AI unavailable" and never substitute fake output.
 *
 * @returns {{name:string,model:string,isConfigured:Function,generate:Function}|null}
 */
function getProvider() {
  if (testProvider) return testProvider;
  if (!env.ai.isConfigured) return null;
  if (!configuredProvider) {
    // Lazy require keeps modules that only need the interface (e.g. crisis rules)
    // from loading the vendor SDK, and avoids a require cycle at module load.
    const { createGeminiProvider } = require('./geminiProvider');
    configuredProvider = createGeminiProvider({
      apiKey: env.ai.apiKey,
      model: env.ai.model,
      timeoutMs: env.ai.timeoutMs,
    });
  }
  return configuredProvider;
}

/**
 * Install an explicit provider (or `null` to restore configuration-driven behaviour).
 * Intended for tests and local verification only — never called on a request path.
 *
 * @param {object|null} provider
 */
function setProviderForTesting(provider) {
  testProvider = provider || null;
  if (!provider) configuredProvider = null;
}

/**
 * @returns {boolean} true when a provider is available (configured or test override)
 */
function isAiConfigured() {
  return getProvider() !== null;
}

module.exports = {
  AI_ERROR_CODES,
  AiProviderError,
  isAiProviderError,
  getProvider,
  setProviderForTesting,
  isAiConfigured,
};
