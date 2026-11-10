'use strict';

/**
 * Structured request logging (docs/ARCHITECTURE.md §12.1).
 *
 * Privacy guarantees enforced here:
 *  - request/response bodies are never logged;
 *  - query strings are dropped (they may carry pasted crisis text or search terms);
 *  - cookies and authorization headers are never logged;
 *  - the client IP is logged only as a truncated HMAC (`ipHash`).
 *
 * Health endpoints are logged at `debug` so liveness probes do not flood logs.
 */
const logger = require('../config/logger');
const { hashIp } = require('../utils/redact');

const HEALTH_PATH = /^\/?(?:(?:api\/v1|api)\/)?health(?:z|\/ready)?\/?$/;

/**
 * @param {string} method
 * @param {string} path
 * @returns {boolean} true for liveness/readiness endpoints
 */
function isHealthCheck(method, path) {
  if (method !== 'GET' && method !== 'HEAD') return false;
  return HEALTH_PATH.test(path);
}

/**
 * Strip the query string and any whitespace/control characters from a path before
 * logging. `req.path` already excludes the query string; the extra normalisation is
 * defence-in-depth against log injection via crafted request targets.
 * @param {import('express').Request} req
 * @returns {string}
 */
function safePath(req) {
  const raw = req.path || (typeof req.originalUrl === 'string' ? req.originalUrl.split('?')[0] : '/');
  // eslint-disable-next-line no-control-regex
  const cleaned = String(raw).replace(/[\u0000-\u001F\u007F]/g, '');
  return cleaned.slice(0, 512) || '/';
}

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {void}
 */
module.exports = function requestLogger(req, res, next) {
  const startedAt = process.hrtime.bigint();

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
    const method = req.method || 'GET';
    const path = safePath(req);

    const meta = {
      requestId: req.id,
      method,
      path,
      status: res.statusCode,
      durationMs: Math.round(durationMs * 10) / 10,
      // Hashing can throw if SESSION_SECRET is missing; logging must never break a request.
      ipHash: safeIpHash(req.ip),
    };

    if (isHealthCheck(method, path)) {
      logger.debug('request', meta);
      return;
    }
    if (res.statusCode >= 500) {
      logger.warn('request', meta);
      return;
    }
    logger.info('request', meta);
  });

  res.on('close', () => {
    // Client aborted before the response finished: log the truncated request once.
    if (res.writableFinished) return;
    logger.warn('request aborted', {
      requestId: req.id,
      method: req.method,
      path: safePath(req),
      status: res.statusCode,
      ipHash: safeIpHash(req.ip),
    });
  });

  next();
};

/**
 * @param {string|undefined} ip
 * @returns {string} hashed IP or 'unknown'
 */
function safeIpHash(ip) {
  try {
    return hashIp(ip);
  } catch {
    return 'unknown';
  }
}
