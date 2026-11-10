'use strict';

/**
 * Authentication flows for `/api/v1/auth` (docs/ARCHITECTURE.md §4.3, §6).
 *
 * Two identity kinds, both server-issued:
 *  - anonymous → `Session.kind='anonymous'`, no PII, ownership id = Session id;
 *  - account   → `Session.kind='user'`, bcrypt password, ownership id = User id.
 *
 * Refresh tokens are opaque 256-bit values carried in the httpOnly `ay_rt` cookie and
 * stored only as SHA-256 (`Session.tokenHash`). Access tokens are short-lived JWTs in
 * `ay_at`; CSRF uses the signed double-submit cookie handled by middleware/csrf.
 */
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Session = require('../models/Session');
const env = require('../config/env');
const logger = require('../config/logger');
const ApiError = require('../utils/ApiError');
const { signAccessToken, generateOpaqueToken, hashToken } = require('../utils/tokens');
const { setSessionCookies } = require('../utils/cookies');
const { hashIp } = require('../utils/redact');
const userService = require('./userService');

const ANONYMOUS_DISPLAY_NAME = 'Anonymous';
const BCRYPT_ROUNDS = 12;
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;
const LOCKOUT_MS = LOCKOUT_MINUTES * 60 * 1000;
const SESSION_TTL_MS = env.sessionTtlDays * 24 * 60 * 60 * 1000;
/** Rotate the refresh token when less than this remains on the session. */
const ROTATE_REMAINING_MS = 24 * 60 * 60 * 1000;

/**
 * A valid bcrypt hash used to keep failed-login timing similar when the email
 * does not exist (prevents user enumeration through response timing).
 */
const TIMING_EQUALIZER_HASH = '$2a$12$NoTerX/8f8OPkKJAxYI4F.3DYJudAoVDcjjof2K8dk3iMldiVF716';

/**
 * Display name for an identity.
 *
 * Anonymous visitors have NO username: every anonymous author is displayed as
 * "Anonymous" until they create an account. Accounts use their chosen display name.
 * @param {'anonymous'|'user'} kind
 * @param {string} [displayName]
 * @returns {string}
 */
function generateAlias(kind, displayName) {
  if (kind === 'user') return (displayName || 'Member').trim().slice(0, 40) || 'Member';
  return ANONYMOUS_DISPLAY_NAME;
}

/**
 * @param {Date} [now]
 * @returns {Date} session expiry timestamp
 */
function expiryDate(now = new Date()) {
  return new Date(now.getTime() + SESSION_TTL_MS);
}

/**
 * Whether a Session document may still be used.
 * @param {object|null} session
 * @returns {boolean}
 */
function isSessionUsable(session) {
  if (!session) return false;
  if (typeof Session.isUsable === 'function') return Session.isUsable(session);
  const expiry = session.expiresAt ? new Date(session.expiresAt).getTime() : 0;
  return !session.revokedAt && expiry > Date.now();
}

/**
 * Create a Session row and its raw refresh token (only the hash is persisted).
 * @param {{kind:'anonymous'|'user', user?: object|null, ip?: string, alias?: string}} input
 * @returns {Promise<{session: object, refreshToken: string}>}
 */
async function createSession({ kind, user = null, ip, alias }) {
  const refreshToken = generateOpaqueToken(32);
  const session = await Session.create({
    kind,
    user: user ? user._id : null,
    tokenHash: hashToken(refreshToken),
    alias: alias || generateAlias(kind, user ? user.displayName : undefined),
    ipHash: hashIp(ip),
    lastSeenAt: new Date(),
    expiresAt: expiryDate(),
  });
  return { session, refreshToken };
}

/**
 * Look up the session referenced by a raw refresh cookie value.
 * @param {string|undefined} rawRefreshToken
 * @returns {Promise<object|null>} usable Session document
 */
async function findSessionByRefreshToken(rawRefreshToken) {
  if (typeof rawRefreshToken !== 'string' || rawRefreshToken.length === 0) return null;
  let hash;
  try {
    hash = hashToken(rawRefreshToken);
  } catch {
    return null;
  }
  const session = await Session.findOne({ tokenHash: hash });
  return isSessionUsable(session) ? session : null;
}

/**
 * Load the user + preferences for a session and verify the principal is still active.
 * @param {object} session Session document
 * @returns {Promise<{session: object, user: object|null, preferences: object}|null>}
 */
async function buildContext(session) {
  if (!isSessionUsable(session)) return null;

  let user = null;
  if (session.kind === 'user') {
    if (!session.user) return null;
    user = await User.findById(session.user);
    if (!user || user.deletedAt || user.status !== 'active') return null;
  } else if (session.user) {
    return null;
  }

  const preferences = await userService.ensurePreference({ session, user });
  return { session, user, preferences };
}

/**
 * The public identity object (§4.3).
 * @param {object} session
 * @param {object|null} user
 * @param {object} preferences UserPreference document
 * @returns {object}
 */
function buildIdentity(session, user, preferences) {
  const createdAt = (user && user.createdAt) || session.createdAt;
  const createdAtIso = createdAt && !Number.isNaN(new Date(createdAt).getTime())
    ? new Date(createdAt).toISOString()
    : new Date().toISOString();
  return {
    id: user ? String(user._id) : String(session._id),
    kind: session.kind,
    role: user ? user.role : 'member',
    // Legacy anonymous sessions stored a generated alias; never expose a username now.
    alias:
      session.kind === 'anonymous'
        ? ANONYMOUS_DISPLAY_NAME
        : session.alias || (user && user.displayName) || 'Member',
    createdAt: createdAtIso,
    isAnonymous: session.kind === 'anonymous',
    preferences: preferences ? preferences.toPublicJSON() : {},
  };
}

/**
 * Sign and set all session cookies.
 * @param {import('express').Response} res
 * @param {{session:object,user:object|null,refreshToken:string,csrfToken:string}} input
 * @returns {void}
 */
function issueSessionCookies(res, { session, user, refreshToken, csrfToken }) {
  const accessToken = signAccessToken({
    sub: String(session._id),
    kind: session.kind,
    role: user ? user.role : 'member',
    ...(user ? { uid: String(user._id) } : {}),
  });
  setSessionCookies(res, { accessToken, refreshToken, csrfToken, maxAgeMs: SESSION_TTL_MS });
}

/**
 * Reuse a valid refresh cookie (rotating it when it is close to expiry) or signal
 * that a brand-new anonymous session is needed.
 * @param {{rawRefreshToken: string|undefined, ip: string}} input
 * @returns {Promise<{context: object, refreshToken: string}|null>}
 */
async function establishSession({ rawRefreshToken, ip }) {
  const existing = await findSessionByRefreshToken(rawRefreshToken);
  if (!existing) return null;

  const context = await buildContext(existing);
  if (!context) {
    // Stale/invalid session (revoked, suspended account, deleted user): revoke it.
    await revokeSession(existing);
    return null;
  }

  const remaining = new Date(existing.expiresAt).getTime() - Date.now();
  if (remaining < ROTATE_REMAINING_MS) {
    return rotateSession({ ...context, session: existing }, { ip });
  }

  existing.lastSeenAt = new Date();
  await existing.save();
  return { context: { ...context, session: existing }, refreshToken: rawRefreshToken };
}

/**
 * Create a fresh anonymous session.
 * @param {{ip: string}} input
 * @returns {Promise<{context: object, refreshToken: string}>}
 */
async function createAnonymousSession({ ip }) {
  const { session, refreshToken } = await createSession({ kind: 'anonymous', ip });
  const context = await buildContext(session);
  if (!context) throw ApiError.internal('Could not start a session');
  return { context, refreshToken };
}

/**
 * Rotate the refresh token in place and extend the session lifetime.
 *
 * Rotation replaces `Session.tokenHash` and `expiresAt` on the *same* Session document.
 * Creating a new Session row instead would change the anonymous ownership id
 * (`identity.id` = Session id, §12.7) every time the client refreshes its 15-minute
 * access token, silently orphaning the caller's threads and replies. In-place rotation
 * keeps ownership stable while still invalidating the previous refresh token, because
 * its hash no longer matches any Session (the "old token is revoked" property).
 * The rotation is recorded in the structured log with a token-hash prefix only.
 *
 * @param {{session: object, user: object|null, preferences: object}} context
 * @param {{ip: string}} input
 * @returns {Promise<{context: object, refreshToken: string}>}
 */
async function rotateSession(context, { ip }) {
  const session = context.session;
  const refreshToken = generateOpaqueToken(32);

  session.tokenHash = hashToken(refreshToken);
  session.expiresAt = expiryDate();
  session.lastSeenAt = new Date();
  if (!session.ipHash && ip) session.ipHash = hashIp(ip);
  await session.save();

  logger.info('auth.session_rotated', {
    sessionHash: hashToken(String(session._id)).slice(0, 12),
    kind: session.kind,
  });

  const preferences =
    context.preferences || (await userService.ensurePreference({ session, user: context.user }));
  return { context: { session, user: context.user, preferences }, refreshToken };
}

/**
 * Revoke a session (best effort — logout must never fail).
 * @param {object|null} session
 * @returns {Promise<void>}
 */
async function revokeSession(session) {
  if (!session || !session._id) return;
  try {
    // `req.identity.session` is a lean object (middleware/auth selects specific fields),
    // so revocation must be an atomic update rather than `doc.save()`.
    await Session.updateOne(
      { _id: session._id, revokedAt: null },
      { $set: { revokedAt: new Date() } }
    );
  } catch (error) {
    logger.warn('auth.session_revoke_failed', { code: error && error.code });
  }
}

/**
 * Resolve a fresh identity context from the middleware identity (used by `/auth/me`).
 * @param {object} identity req.identity
 * @returns {Promise<{context: object, identity: object}>}
 */
async function getIdentity(identity) {
  // `loadIdentity` selects only the fields it needs; re-read the session so the
  // identity's `createdAt` is the real session creation time.
  const session = await Session.findById(identity.sessionId);
  const context = await buildContext(session);
  if (!context) throw ApiError.unauthorized('Your session has expired, please sign in again');
  return { context, identity: buildIdentity(context.session, context.user, context.preferences) };
}

/**
 * Create a member account (bcrypt hashing is performed by the User model's pre-save hook).
 * @param {{email: string, password: string, displayName?: string}} input
 * @returns {Promise<object>} User document
 */
async function register({ email, password, displayName }) {
  const existing = await User.findOne({ email });
  if (existing) throw ApiError.conflict('An account with this email already exists');

  try {
    return await User.create({
      email,
      passwordHash: password,
      displayName: displayName || generateAlias('user'),
      role: 'member',
      status: 'active',
    });
  } catch (error) {
    if (error && error.code === 11000) {
      throw ApiError.conflict('An account with this email already exists');
    }
    throw error;
  }
}

/**
 * Verify credentials with lockout and enumeration-safe failure messages.
 * @param {{email: string, password: string}} input
 * @returns {Promise<object>} active User document
 */
async function authenticate({ email, password }) {
  const user = await User.findOne({ email }).select('+passwordHash +email');
  if (!user) {
    await bcrypt.compare(password, TIMING_EQUALIZER_HASH);
    throw ApiError.unauthorized('Email or password is incorrect');
  }

  if (user.status === 'suspended') throw ApiError.forbidden('This account is suspended');
  if (user.deletedAt) throw ApiError.unauthorized('Email or password is incorrect');

  const lockRemainingMs = user.lockedUntil ? new Date(user.lockedUntil).getTime() - Date.now() : 0;
  if (lockRemainingMs > 0) {
    throw ApiError.tooMany(
      `Too many failed sign-in attempts. Try again in ${Math.ceil(lockRemainingMs / 60000)} minute(s).`,
      Math.ceil(lockRemainingMs / 1000)
    );
  }

  const matches =
    typeof user.comparePassword === 'function'
      ? await user.comparePassword(password)
      : await bcrypt.compare(password, user.passwordHash || '');

  if (!matches) {
    user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
    if (user.failedLoginAttempts >= MAX_FAILED_ATTEMPTS) {
      user.lockedUntil = new Date(Date.now() + LOCKOUT_MS);
    }
    await user.save();
    throw ApiError.unauthorized('Email or password is incorrect');
  }

  user.failedLoginAttempts = 0;
  user.lockedUntil = undefined;
  user.lastLoginAt = new Date();
  await user.save();
  return user;
}

/**
 * Create a logged-in Session for an account.
 * @param {object} user User document
 * @param {{ip: string}} input
 * @returns {Promise<{context: object, refreshToken: string}>}
 */
async function createAccountSession(user, { ip }) {
  const { session, refreshToken } = await createSession({ kind: 'user', user, ip });
  const context = await buildContext(session);
  if (!context) throw ApiError.internal('Could not start a session');
  return { context, refreshToken };
}

module.exports = {
  BCRYPT_ROUNDS,
  MAX_FAILED_ATTEMPTS,
  LOCKOUT_MINUTES,
  generateAlias,
  isSessionUsable,
  createSession,
  findSessionByRefreshToken,
  buildContext,
  buildIdentity,
  issueSessionCookies,
  establishSession,
  createAnonymousSession,
  rotateSession,
  revokeSession,
  getIdentity,
  register,
  authenticate,
  createAccountSession,
};
