'use strict';

/**
 * CORS allow-list (docs/ARCHITECTURE.md §12.1).
 *
 * Rules:
 *  - only origins listed in `env.corsOrigins` are ever reflected; `origin: true`
 *    (reflect anything) is never combined with `credentials: true`;
 *  - requests with no `Origin` header (same-origin navigations, curl, server-to-server)
 *    are passed through untouched — CORS is a browser policy, not an auth boundary;
 *  - unknown origins receive no CORS headers; a preflight from an unknown origin is
 *    rejected with the standard `403 FORBIDDEN` envelope so the browser fails closed;
 *  - credentials are allowed (httpOnly session cookies), so the API URL must be
 *    configured with `COOKIE_SAMESITE=lax` on a shared parent domain, or `none`+HTTPS.
 */
const cors = require('cors');
const env = require('../config/env');
const ApiError = require('../utils/ApiError');

const ALLOWED_METHODS = ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'];
const ALLOWED_HEADERS = ['Content-Type', 'x-csrf-token', 'x-request-id', 'Accept'];
const EXPOSED_HEADERS = ['x-request-id'];
const PREFLIGHT_MAX_AGE_SECONDS = 600;

/** @type {Set<string>} normalised allow-list */
const allowedOrigins = new Set(
  (env.corsOrigins || [])
    .map((origin) => normaliseOrigin(origin))
    .filter((origin) => origin && origin !== '*')
);

/**
 * @param {string} origin
 * @returns {string} normalised origin (lower-case, no trailing slash)
 */
function normaliseOrigin(origin) {
  return String(origin || '').trim().replace(/\/+$/, '').toLowerCase();
}

/**
 * @param {string|undefined} origin
 * @returns {boolean}
 */
function isAllowedOrigin(origin) {
  if (!origin) return false;
  return allowedOrigins.has(normaliseOrigin(origin));
}

const corsOptionsDelegate = cors({
  origin(origin, callback) {
    // No Origin header: not a cross-origin browser request.
    if (!origin) return callback(null, false);
    // Reflect only allow-listed origins. `false` means "no CORS headers".
    return callback(null, allowedOrigins.has(normaliseOrigin(origin)) ? origin : false);
  },
  credentials: true,
  methods: ALLOWED_METHODS.join(','),
  allowedHeaders: ALLOWED_HEADERS.join(','),
  exposedHeaders: EXPOSED_HEADERS.join(','),
  maxAge: PREFLIGHT_MAX_AGE_SECONDS,
  optionsSuccessStatus: 204,
});

/**
 * CORS middleware with explicit rejection of unknown-origin preflights.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {void}
 */
function corsMiddleware(req, res, next) {
  const origin = req.headers.origin;

  if (origin && !isAllowedOrigin(origin)) {
    if (req.method === 'OPTIONS') {
      const error = ApiError.forbidden('This origin is not allowed to call the API');
      error.code = 'FORBIDDEN';
      return next(error);
    }
    // Non-preflight from an unknown origin: continue without CORS headers so the
    // browser still blocks the response. Cookies are protected by SameSite + CSRF.
    return next();
  }

  return corsOptionsDelegate(req, res, next);
}

module.exports = corsMiddleware;
module.exports.isAllowedOrigin = isAllowedOrigin;
module.exports.ALLOWED_METHODS = ALLOWED_METHODS;
module.exports.ALLOWED_HEADERS = ALLOWED_HEADERS;
