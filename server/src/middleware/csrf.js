'use strict';

/**
 * CSRF protection — double-submit cookie + HMAC (docs/ARCHITECTURE.md §6.3, §12.1).
 *
 * The readable `ay_csrf` cookie contains `<raw>.<hmac(raw, SESSION_SECRET)>`.
 * Every unsafe request must send `x-csrf-token` equal to that cookie value, and the
 * value must carry a valid HMAC. This blocks classic CSRF (attacker cannot read the
 * cookie to populate the header) and token-substitution attacks (attacker cannot
 * forge the HMAC).
 *
 * Exemption: only the unauthenticated bootstrap endpoints (`POST /auth/session`,
 * `/auth/login`, `/auth/register`) may run without a CSRF token, and ONLY when the
 * request carries no `ay_rt` refresh cookie. As soon as a session exists the token is
 * required on those routes too — there is no session-bearing CSRF bypass.
 *
 * Interop note (sanctioned by the orchestrator): `issueCsrfToken(req, res)` is a plain
 * synchronous helper returning the signed token string, not Express middleware.
 */
const crypto = require('crypto');
const env = require('../config/env');
const ApiError = require('../utils/ApiError');
const { COOKIE_NAMES, setCsrfCookie } = require('../utils/cookies');
const { generateOpaqueToken, signCsrfToken, verifyCsrfToken } = require('../utils/tokens');

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const CSRF_HEADER = 'x-csrf-token';

/** Bootstrap endpoints that are exempt while no session cookie exists. */
const BOOTSTRAP_PATHS = new Set(['/auth/session', '/auth/login', '/auth/register']);

/**
 * Path relative to the `/api/v1` mount, tolerating the middleware running either
 * inside the mounted router (the app.js case) or at the app root.
 * @param {import('express').Request} req
 * @returns {string}
 */
function relativePath(req) {
  const path = req.path || '/';
  const base = env.apiBasePath || '';
  if (base && path.startsWith(`${base}/`)) return path.slice(base.length);
  return path;
}

/**
 * Constant-time string comparison of equal-length buffers.
 * Length is not secret here (both values are client-visible); content is.
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
function safeEqual(a, b) {
  const left = Buffer.from(String(a), 'utf8');
  const right = Buffer.from(String(b), 'utf8');
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

/**
 * Create, sign and set a fresh CSRF token. Returns the signed token so the auth
 * controller can echo it to the client in the response body.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {string} signed `<raw>.<hmac>` token
 */
function issueCsrfToken(req, res) {
  const raw = generateOpaqueToken(32);
  const signed = signCsrfToken(raw);

  setCsrfCookie(res, signed);

  if (req) req.csrfToken = signed;
  if (res && res.locals) res.locals.csrfToken = signed;

  return signed;
}

/**
 * Current signed CSRF token for this request (from the cookie or a token issued
 * earlier in the same request). When `res` is provided and no token exists, a new
 * one is issued and its cookie set.
 * @param {import('express').Request} req
 * @param {import('express').Response} [res]
 * @returns {string|null}
 */
function csrfTokenFor(req, res) {
  if (req) {
    if (typeof req.csrfToken === 'string' && req.csrfToken) return req.csrfToken;
    const cookieToken = req.cookies && req.cookies[COOKIE_NAMES.csrf];
    if (typeof cookieToken === 'string' && cookieToken) return cookieToken;
  }
  if (res) return issueCsrfToken(req, res);
  return null;
}

/**
 * Enforce CSRF on unsafe requests. Wire once globally:
 * `app.use(env.apiBasePath, requireCsrf, apiRouter)`.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {void}
 */
function requireCsrf(req, res, next) {
  if (SAFE_METHODS.has(req.method)) return next();

  const path = relativePath(req);
  const hasRefreshCookie = Boolean(req.cookies && req.cookies[COOKIE_NAMES.refresh]);
  if (BOOTSTRAP_PATHS.has(path) && !hasRefreshCookie) return next();

  const headerToken = req.get ? req.get(CSRF_HEADER) : req.headers && req.headers[CSRF_HEADER];
  const cookieToken = req.cookies && req.cookies[COOKIE_NAMES.csrf];

  if (typeof headerToken !== 'string' || headerToken.length === 0) {
    return next(ApiError.csrf('Missing CSRF token'));
  }
  if (typeof cookieToken !== 'string' || cookieToken.length === 0) {
    return next(ApiError.csrf('Missing CSRF cookie. Fetch /auth/csrf and retry'));
  }
  if (!safeEqual(headerToken, cookieToken)) {
    return next(ApiError.csrf('CSRF token does not match the session cookie'));
  }
  if (!verifyCsrfToken(cookieToken)) {
    return next(ApiError.csrf('CSRF token signature is invalid'));
  }

  return next();
}

module.exports = {
  issueCsrfToken,
  requireCsrf,
  csrfTokenFor,
  // Additive exports (tests / other middleware).
  CSRF_HEADER,
  SAFE_METHODS,
  BOOTSTRAP_PATHS,
};
