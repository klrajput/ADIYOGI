'use strict';

/**
 * Auth controllers (`/api/v1/auth`, docs/ARCHITECTURE.md §4.3, §4.4).
 *
 * Tokens never appear in JSON: the access JWT, refresh token and CSRF cookie are set
 * as httpOnly/readable cookies. Only the CSRF token (a double-submit value, not a
 * credential) is returned in the body when issued.
 */
const { COOKIE_NAMES, clearSessionCookies } = require('../utils/cookies');
const ApiError = require('../utils/ApiError');
const { issueCsrfToken, csrfTokenFor } = require('../middleware/csrf');
const { ok, created, noContent } = require('../utils/response');
const authService = require('../services/authService');

/**
 * @param {{context: object}} established
 * @returns {object} public identity
 */
function identityOf(established) {
  return authService.buildIdentity(
    established.context.session,
    established.context.user,
    established.context.preferences
  );
}

/**
 * Issue the httpOnly session cookies for an established session and return the
 * signed CSRF token (also set as a readable cookie).
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {{context: object, refreshToken: string}} established
 * @returns {string} signed CSRF token
 */
function issueAuthCookies(req, res, established) {
  const csrfToken = issueCsrfToken(req, res);
  authService.issueSessionCookies(res, {
    session: established.context.session,
    user: established.context.user,
    refreshToken: established.refreshToken,
    csrfToken,
  });
  return csrfToken;
}

/**
 * POST /auth/session — reuse the refresh cookie when valid, otherwise start an
 * anonymous session. Always sets a fresh access token and CSRF cookie.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<import('express').Response>}
 */
async function createSession(req, res) {
  const rawRefreshToken = req.cookies ? req.cookies[COOKIE_NAMES.refresh] : undefined;

  let established = await authService.establishSession({ rawRefreshToken, ip: req.ip });
  if (!established) established = await authService.createAnonymousSession({ ip: req.ip });

  const csrfToken = issueAuthCookies(req, res, established);

  return ok(res, { identity: identityOf(established), csrfToken }, { message: 'Session ready' });
}

/**
 * GET /auth/me — the caller's identity and preferences.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<import('express').Response>}
 */
async function getMe(req, res) {
  const { identity } = await authService.getIdentity(req.identity);
  return ok(res, { identity }, { message: 'OK' });
}

/**
 * GET /auth/csrf — return the current signed CSRF token (issue one when missing).
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {import('express').Response}
 */
function getCsrf(req, res) {
  const existing = csrfTokenFor(req, res);
  const csrfToken = existing || issueCsrfToken(req, res);
  return ok(res, { csrfToken }, { message: 'OK' });
}

/**
 * POST /auth/register — create a member account and sign it in.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<import('express').Response>}
 */
async function register(req, res) {
  const user = await authService.register(req.body);
  const established = await authService.createAccountSession(user, { ip: req.ip });

  const csrfToken = issueAuthCookies(req, res, established);

  return created(res, { identity: identityOf(established), csrfToken }, { message: 'Account created' });
}

/**
 * POST /auth/login — verify credentials (lockout-aware) and start an account session.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<import('express').Response>}
 */
async function login(req, res) {
  const user = await authService.authenticate(req.body);
  const established = await authService.createAccountSession(user, { ip: req.ip });

  const csrfToken = issueAuthCookies(req, res, established);

  return ok(res, { identity: identityOf(established), csrfToken }, { message: 'Signed in' });
}

/**
 * POST /auth/logout — revoke the current session and clear cookies.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<import('express').Response>}
 */
async function logout(req, res) {
  const rawRefreshToken = req.cookies ? req.cookies[COOKIE_NAMES.refresh] : undefined;
  let session = req.identity && req.identity.session ? req.identity.session : null;
  if (!session && rawRefreshToken) session = await authService.findSessionByRefreshToken(rawRefreshToken);
  if (session) await authService.revokeSession(session);

  clearSessionCookies(res);
  return noContent(res);
}

/**
 * POST /auth/refresh — rotate the refresh token and issue a new access token.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<import('express').Response>}
 */
async function refresh(req, res) {
  const rawRefreshToken = req.cookies ? req.cookies[COOKIE_NAMES.refresh] : undefined;
  const session = await authService.findSessionByRefreshToken(rawRefreshToken);
  const context = session ? await authService.buildContext(session) : null;

  if (!context) {
    if (session) await authService.revokeSession(session);
    clearSessionCookies(res);
    throw ApiError.unauthorized('Your session has expired, please start a new session');
  }

  const rotated = await authService.rotateSession(context, { ip: req.ip });
  const csrfToken = issueAuthCookies(req, res, rotated);

  return ok(res, { identity: identityOf(rotated), csrfToken }, { message: 'Session refreshed' });
}

module.exports = { createSession, getMe, getCsrf, register, login, logout, refresh };
