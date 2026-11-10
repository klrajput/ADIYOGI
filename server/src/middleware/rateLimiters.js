'use strict';

/**
 * Rate limiting (docs/ARCHITECTURE.md §6.5, §12.1).
 *
 * All limiters reply with the standard error envelope:
 *   429 { success:false, error:{ code:'RATE_LIMITED', details:{ retryAfterSeconds } },
 *         message, requestId }
 * plus a `Retry-After` header and draft-7 `RateLimit-*` headers.
 *
 * Keys are the server-side session id when the request is authenticated, otherwise a
 * truncated HMAC of the client IP — the raw IP is never used as a key or logged.
 *
 * Note: the default store is in-memory, i.e. per-process. Horizontal scaling must use
 * a shared store (documented limitation in docs/SECURITY.md).
 */
const { rateLimit } = require('express-rate-limit');
const env = require('../config/env');
const ApiError = require('../utils/ApiError');
const { hashIp } = require('../utils/redact');

const MINUTE_MS = 60 * 1000;

const LIMITS = Object.freeze({
  auth: { windowMs: 15 * MINUTE_MS, max: 10 },
  write: { windowMs: 10 * MINUTE_MS, max: 20 },
  report: { windowMs: 60 * MINUTE_MS, max: 10 },
  crisisAssess: { windowMs: 10 * MINUTE_MS, max: 30 },
  chat: { windowMs: 5 * MINUTE_MS, max: env.rateLimits.chatMax },
  global: { windowMs: env.rateLimits.windowMinutes * MINUTE_MS, max: env.rateLimits.globalMax },
});

/**
 * Stable, privacy-preserving limiter key.
 * @param {import('express').Request} req
 * @returns {string}
 */
function keyFor(req) {
  const sessionId = req.identity && req.identity.sessionId;
  if (sessionId) return `session:${String(sessionId)}`;
  try {
    return `ip:${hashIp(req.ip)}`;
  } catch {
    // Misconfigured SESSION_SECRET: fail to a single shared bucket rather than
    // storing the raw IP. This is unreachable in production (env.js fails fast).
    return 'ip:unhashed';
  }
}

/**
 * @param {string} method
 * @param {string} path
 * @returns {boolean}
 */
function isHealthCheck(method, path) {
  if (method !== 'GET' && method !== 'HEAD') return false;
  return /^\/?(?:(?:api\/v1|api)\/)?health(?:z|\/ready)?\/?$/.test(path || '');
}

/**
 * 429 handler shared by every limiter: set Retry-After, then go through the error
 * envelope pipeline.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @param {{windowMs?:number}} options
 * @returns {void}
 */
function limitHandler(req, res, next, options) {
  const resetTime = req.rateLimit && req.rateLimit.resetTime;
  const retryAfterSeconds =
    resetTime instanceof Date
      ? Math.max(1, Math.ceil((resetTime.getTime() - Date.now()) / 1000))
      : Math.max(1, Math.ceil((options && options.windowMs ? options.windowMs : MINUTE_MS) / 1000));

  if (!res.headersSent) res.setHeader('Retry-After', String(retryAfterSeconds));

  next(
    ApiError.tooMany(
      'Too many requests from this session. Please wait a moment and try again.',
      retryAfterSeconds
    )
  );
}

/**
 * Build one limiter with the shared contract settings.
 * @param {{windowMs:number, max:number, skipSuccessfulRequests?:boolean, skip?:Function}} options
 * @returns {import('express').RequestHandler}
 */
function createLimiter({ windowMs, max, skipSuccessfulRequests = false, skip }) {
  return rateLimit({
    windowMs,
    limit: max,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator: keyFor,
    skipSuccessfulRequests,
    handler: limitHandler,
    ...(skip ? { skip } : {}),
  });
}

/** All requests; health probes are excluded so liveness checks never trip it. */
const globalLimiter = createLimiter({
  windowMs: LIMITS.global.windowMs,
  max: LIMITS.global.max,
  skip: (req) => isHealthCheck(req.method, req.path),
});

/** Authentication/session bootstrap: only failed attempts count (skipSuccessfulRequests). */
const authLimiter = createLimiter({
  windowMs: LIMITS.auth.windowMs,
  max: LIMITS.auth.max,
  skipSuccessfulRequests: true,
});

/** State-changing community writes (threads, replies, preferences, deletions). */
const writeLimiter = createLimiter({
  windowMs: LIMITS.write.windowMs,
  max: LIMITS.write.max,
});

/** Content reports: very low volume by design. */
const reportLimiter = createLimiter({
  windowMs: LIMITS.report.windowMs,
  max: LIMITS.report.max,
});

/** AI chat messages: per-session cost control. */
const chatLimiter = createLimiter({
  windowMs: LIMITS.chat.windowMs,
  max: LIMITS.chat.max,
});

/** Crisis text assessment (the text is not stored; only rate-limited). */
const crisisAssessLimiter = createLimiter({
  windowMs: LIMITS.crisisAssess.windowMs,
  max: LIMITS.crisisAssess.max,
});

module.exports = {
  globalLimiter,
  authLimiter,
  writeLimiter,
  reportLimiter,
  chatLimiter,
  crisisAssessLimiter,
  // Additive exports for tests/configuration visibility.
  LIMITS,
  keyFor,
};
