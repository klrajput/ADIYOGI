'use strict';

/**
 * AI chat service (docs/ARCHITECTURE.md §7, §12.4).
 *
 * Guarantees:
 *  - ownership is enforced against the server-side identity, never client ids;
 *  - the provider is the only source of assistant text — on any provider failure
 *    this throws `503 AI_UNAVAILABLE` and persists NOTHING (a retry cannot
 *    duplicate a half-written turn, and no canned reply is ever invented);
 *  - user + assistant messages are persisted together only after a real provider
 *    response, with TTL/retention owned by the models;
 *  - risk is assessed server-side on every user message; `elevated`/`high` creates
 *    a metadata-only CrisisEvent, and `high` additionally stores a deterministic
 *    (non-AI) crisis-resources safety message from the server;
 *  - the guided-exercise fallback is explicitly non-AI and is returned only in the
 *    error details — it is never written into the conversation.
 */
const env = require('../config/env');
const logger = require('../config/logger');
const ApiError = require('../utils/ApiError');
const Conversation = require('../models/Conversation');
const ChatMessage = require('../models/ChatMessage');
const crisisService = require('./crisisService');
const { getProvider } = require('./ai/provider');
const { SYSTEM_PROMPT, buildMessages } = require('./ai/prompt');

const MAX_MESSAGE_CHARS = 2000;
const HISTORY_LIMIT = 12;
const MAX_TITLE_CHARS = 120;
const DEFAULT_TITLE = 'New conversation';
const AI_RETRY_AFTER_SECONDS = 20;

const CRISIS_LEVEL_RANK = Object.freeze({ none: 0, low: 1, elevated: 2, high: 3 });

/**
 * The explicit NON-AI fallback offered when the provider is unavailable.
 * Returned in `error.details.guidedExercise` only; never inserted into the chat.
 *
 * @returns {{title:string, steps:string[]}}
 */
function guidedExercise() {
  return {
    title: 'A short grounding exercise (not AI — written by AdiYogi)',
    steps: [
      'Sit or stand somewhere you feel safe, and let your shoulders drop.',
      'Breathe in slowly through your nose for 4 counts, hold for 2, and breathe out for 6.',
      'Repeat that breath five times, and notice the chair or floor supporting you.',
      'Name three things you can see, two you can hear, and one thing you can touch.',
      'If you can, send one message to a person you trust, or contact a helpline from the crisis resources.',
    ],
  };
}

/**
 * Deterministic, server-authored crisis message for high-risk chat turns.
 * Deliberately not AI text: fixed wording built from the verified resources table.
 *
 * @param {object} resources crisisService.getResources() output
 * @returns {string}
 */
function buildCrisisSafetyMessage(resources) {
  const { primary, text, emergency, local, disclaimer } = resources;
  const lines = [
    "I'm really glad you told me. What you're carrying sounds heavy, and you deserve support right now.",
    '',
    'Please reach out to a person who can help — you do not have to handle this alone:',
  ];

  if (primary) {
    const channel = primary.type === 'text' ? 'text' : 'call';
    lines.push(`- ${primary.name}: ${primary.contact} (${primary.available || 'available'}) — ${channel}`);
  }
  if (text) lines.push(`- ${text.name}: ${text.contact} (${text.available || 'available'})`);
  for (const entry of Array.isArray(local) ? local : []) {
    lines.push(`- ${entry.name}: ${entry.contact}${entry.available ? ` (${entry.available})` : ''}`);
  }
  if (emergency) {
    lines.push(`- If you are in immediate danger, contact ${emergency.name}: ${emergency.contact}`);
  }
  lines.push('', 'If you can, tell someone nearby that you are not safe alone right now.');
  lines.push('', 'Note: AdiYogi is not a crisis service and cannot monitor emergencies.');
  if (disclaimer) lines.push(disclaimer);

  return lines.join('\n');
}

/**
 * Resolve the caller's ownership coordinates from the server-side identity.
 * @param {object} identity req.identity
 * @returns {{ownerType:'session'|'user', ownerId:string}}
 */
function ownerOf(identity) {
  if (!identity || !identity.sessionId) {
    throw ApiError.unauthorized('A session is required to use the AI companion');
  }
  if (identity.kind === 'user') {
    if (!identity.userId) throw ApiError.unauthorized('A session is required to use the AI companion');
    return { ownerType: 'user', ownerId: String(identity.userId) };
  }
  return { ownerType: 'session', ownerId: String(identity.sessionId) };
}

/**
 * @param {string} id
 * @returns {boolean}
 */
function isObjectIdLike(id) {
  return typeof id === 'string' && /^[a-f\d]{24}$/i.test(id);
}

/**
 * Public serialisation; prefers the model contract, with a minimal safe fallback.
 * @param {*} doc
 * @param {'conversation'|'message'} kind
 * @returns {object|null}
 */
function toPublic(doc, kind) {
  if (!doc) return null;
  if (typeof doc.toPublicJSON === 'function') return doc.toPublicJSON();
  if (kind === 'message') {
    return {
      id: String(doc._id),
      conversation: String(doc.conversation),
      role: doc.role,
      content: doc.content,
      riskLevel: doc.riskLevel || 'none',
      aiProvider: doc.aiProvider || 'none',
      aiModel: doc.aiModel || null,
      createdAt: doc.createdAt,
    };
  }
  return {
    id: String(doc._id),
    title: doc.title,
    messageCount: doc.messageCount || 0,
    lastMessageAt: doc.lastMessageAt,
    riskLevel: doc.riskLevel || 'none',
    status: doc.status || 'active',
    createdAt: doc.createdAt,
  };
}

/**
 * Sanitise a user-supplied conversation title (plain text, bounded).
 * @param {*} title
 * @returns {string}
 */
function normaliseTitle(title) {
  if (typeof title !== 'string') return DEFAULT_TITLE;
  const cleaned = title
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_TITLE_CHARS);
  return cleaned || DEFAULT_TITLE;
}

/**
 * @param {object} identity
 * @param {string} conversationId
 * @returns {Promise<object>} owned conversation document
 */
async function findOwnedConversation(identity, conversationId) {
  const owner = ownerOf(identity);
  if (!isObjectIdLike(conversationId)) {
    throw ApiError.notFound('Conversation not found');
  }
  const conversation = await Conversation.findOne({
    _id: conversationId,
    ownerType: owner.ownerType,
    ownerId: owner.ownerId,
  });
  if (!conversation) throw ApiError.notFound('Conversation not found');
  return conversation;
}

/**
 * Live regional resources for a chat turn.
 * @param {object} identity
 * @returns {object}
 */
function resourcesFor(identity) {
  return crisisService.getResources({ country: identity && identity.country });
}

/**
 * Build the 503 error. Details are additive and always explicitly label the
 * guided exercise as non-AI; `resources` (when the turn looked risky) lets the UI
 * surface help even though no AI reply exists.
 *
 * @param {{configured:boolean, assessment?:object, cause?:string, identity?:object}} input
 * @returns {ApiError}
 */
function buildAiUnavailable({ configured, assessment, cause, identity }) {
  const details = {
    retryAfterSeconds: AI_RETRY_AFTER_SECONDS,
    canUseGuidedMode: env.ai.fallbackGuided,
  };
  if (env.ai.fallbackGuided) details.guidedExercise = guidedExercise();
  if (assessment && assessment.showResources) details.resources = resourcesFor(identity);
  if (cause) details.cause = cause;

  const message = configured
    ? 'The AI companion is temporarily unavailable'
    : "The AI companion isn't configured on this deployment";

  return ApiError.aiUnavailable(message, details);
}

/**
 * @param {object} identity
 * @param {{title?:string}} [options]
 * @returns {Promise<object>} public conversation
 */
async function createConversation(identity, { title } = {}) {
  const owner = ownerOf(identity);
  const conversation = await Conversation.create({
    ownerType: owner.ownerType,
    ownerId: owner.ownerId,
    title: normaliseTitle(title),
    messageCount: 0,
    lastMessageAt: new Date(),
    riskLevel: 'none',
    status: 'active',
  });
  return toPublic(conversation, 'conversation');
}

/**
 * @param {object} identity
 * @param {{page?:number, limit?:number}} [options]
 * @returns {Promise<{conversations:object[], total:number, page:number, limit:number}>}
 */
async function listConversations(identity, { page = 1, limit = 20 } = {}) {
  const owner = ownerOf(identity);
  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
  const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.min(Math.floor(limit), 50) : 20;
  const filter = { ownerType: owner.ownerType, ownerId: owner.ownerId };

  const [docs, total] = await Promise.all([
    Conversation.find(filter)
      .sort({ lastMessageAt: -1, createdAt: -1 })
      .skip((safePage - 1) * safeLimit)
      .limit(safeLimit),
    Conversation.countDocuments(filter),
  ]);

  return {
    conversations: docs.map((doc) => toPublic(doc, 'conversation')),
    total,
    page: safePage,
    limit: safeLimit,
  };
}

/**
 * Conversation with its most recent 100 messages, oldest → newest.
 * Messages are also bounded by the model TTL.
 *
 * @param {object} identity
 * @param {string} conversationId
 * @returns {Promise<{conversation:object, messages:object[], total:number}>}
 */
async function getConversation(identity, conversationId) {
  const conversation = await findOwnedConversation(identity, conversationId);
  const docs = await ChatMessage.find({ conversation: conversation._id })
    .sort({ createdAt: -1 })
    .limit(100);
  const messages = docs.reverse().map((doc) => toPublic(doc, 'message'));
  return {
    conversation: toPublic(conversation, 'conversation'),
    messages,
    total: Number.isFinite(conversation.messageCount) ? conversation.messageCount : messages.length,
  };
}

/**
 * Validate a chat message body defensively (the route validates too).
 * @param {*} content
 * @returns {string} trimmed content
 */
function normaliseContent(content) {
  if (typeof content !== 'string') {
    throw ApiError.badRequest('VALIDATION_ERROR', 'Message content must be text', [
      { path: 'content', message: 'Required' },
    ]);
  }
  const trimmed = content.trim();
  if (!trimmed) {
    throw ApiError.badRequest('VALIDATION_ERROR', 'Message cannot be empty', [
      { path: 'content', message: 'Message cannot be empty' },
    ]);
  }
  if (trimmed.length > MAX_MESSAGE_CHARS) {
    throw ApiError.badRequest(
      'VALIDATION_ERROR',
      `Message must be at most ${MAX_MESSAGE_CHARS} characters`,
      [{ path: 'content', message: `Maximum ${MAX_MESSAGE_CHARS} characters` }]
    );
  }
  return trimmed;
}

/**
 * Send a message, get a real AI reply, then persist the whole turn.
 *
 * @param {object} identity
 * @param {string} conversationId
 * @param {string} content
 * @returns {Promise<{userMessage:object, assistantMessage:object, risk:object, ai:object, resources?:object, safetyMessage?:object}>}
 */
async function sendMessage(identity, conversationId, content) {
  const conversation = await findOwnedConversation(identity, conversationId);
  const messageText = normaliseContent(content);

  // 1) Server-side risk assessment always runs, even when the provider is down.
  const risk = await crisisService.assess(messageText, { source: 'chat' });

  // 2) Provider must exist; otherwise honest 503 with no persistence.
  const provider = getProvider();
  if (!provider) {
    throw buildAiUnavailable({ configured: false, assessment: risk, identity });
  }

  // 3) Conversation history: last 12 persisted messages, oldest → newest.
  const historyDocs = await ChatMessage.find({ conversation: conversation._id })
    .sort({ createdAt: -1 })
    .limit(HISTORY_LIMIT);
  const history = historyDocs
    .reverse()
    .map((doc) => ({ role: doc.role, content: doc.content }));

  // 4) One real provider call. No fallback text, ever.
  let generated;
  try {
    generated = await provider.generate({
      messages: buildMessages(history, messageText),
      systemPrompt: SYSTEM_PROMPT,
    });
  } catch (error) {
    logger.warn('chat provider failure', {
      provider: provider.name,
      code: (error && error.code) || 'AI_PROVIDER_ERROR',
    });
    throw buildAiUnavailable({
      configured: true,
      assessment: risk,
      cause: (error && error.code) || 'AI_PROVIDER_ERROR',
      identity,
    });
  }

  const assistantText =
    generated && typeof generated.text === 'string' ? generated.text.trim() : '';
  if (!assistantText) {
    // A provider that "succeeds" with no text is a failure, not an empty reply.
    throw buildAiUnavailable({
      configured: true,
      assessment: risk,
      cause: 'AI_EMPTY_RESPONSE',
      identity,
    });
  }

  const providerName = provider.name || 'gemini';
  const providerModel = provider.model || env.ai.model;
  const resources = resourcesFor(identity);

  // 5) Persist the turn only after a real assistant answer exists.
  const createdIds = [];
  let userMessage;
  let assistantMessage;
  let safetyMessage = null;

  try {
    userMessage = await ChatMessage.create({
      conversation: conversation._id,
      role: 'user',
      content: messageText,
      riskLevel: risk.level,
      aiProvider: 'none',
      aiModel: null,
    });
    createdIds.push(userMessage._id);

    if (risk.level === 'high') {
      safetyMessage = await ChatMessage.create({
        conversation: conversation._id,
        role: 'assistant',
        content: buildCrisisSafetyMessage(resources),
        riskLevel: risk.level,
        aiProvider: 'none',
        aiModel: 'server-crisis-resources',
      });
      createdIds.push(safetyMessage._id);
    }

    assistantMessage = await ChatMessage.create({
      conversation: conversation._id,
      role: 'assistant',
      content: assistantText,
      riskLevel: 'none',
      aiProvider: providerName,
      aiModel: providerModel,
    });
    createdIds.push(assistantMessage._id);

    const previousRisk = CRISIS_LEVEL_RANK[conversation.riskLevel] || 0;
    const currentRisk = CRISIS_LEVEL_RANK[risk.level] || 0;

    await Conversation.updateOne(
      { _id: conversation._id },
      {
        $inc: { messageCount: createdIds.length },
        $set: {
          lastMessageAt: new Date(),
          riskLevel: currentRisk >= previousRisk ? risk.level : conversation.riskLevel,
        },
      }
    );
  } catch (error) {
    // Best-effort rollback so a retry cannot duplicate a partial turn.
    if (createdIds.length > 0) {
      try {
        await ChatMessage.deleteMany({ _id: { $in: createdIds } });
      } catch (cleanupError) {
        logger.error('chat turn rollback failed', {
          code: (cleanupError && cleanupError.name) || 'ROLLBACK_ERROR',
        });
      }
    }
    logger.error('chat turn could not be persisted', {
      code: (error && error.name) || 'PERSISTENCE_ERROR',
    });
    throw ApiError.internal('Your message could not be saved. Please try again.');
  }

  // 6) Metadata-only crisis event for elevated/high chat turns.
  if (risk.level === 'elevated' || risk.level === 'high') {
    await crisisService.recordEvent({
      sessionId: identity.sessionId,
      level: risk.level,
      source: 'chat',
      triggerCodes: risk.reasons,
      country: identity.country,
      resourcesShown: risk.showResources,
    });
  }

  const payload = {
    userMessage: toPublic(userMessage, 'message'),
    assistantMessage: toPublic(assistantMessage, 'message'),
    risk,
    ai: { provider: providerName, model: providerModel, degraded: false },
  };
  if (risk.showResources) payload.resources = resources;
  if (safetyMessage) payload.safetyMessage = toPublic(safetyMessage, 'message');
  return payload;
}

/**
 * Hard-delete a conversation and all of its messages (privacy requirement).
 * @param {object} identity
 * @param {string} conversationId
 * @returns {Promise<void>}
 */
async function deleteConversation(identity, conversationId) {
  const conversation = await findOwnedConversation(identity, conversationId);
  await ChatMessage.deleteMany({ conversation: conversation._id });
  await Conversation.deleteOne({ _id: conversation._id });
}

module.exports = {
  createConversation,
  listConversations,
  getConversation,
  sendMessage,
  deleteConversation,
};
