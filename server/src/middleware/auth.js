'use strict';

/**
 * Authentication / authorization middleware (docs/ARCHITECTURE.md §6, §12.1).
 *
 * Identity is always resolved server-side:
 *  1. `loadIdentity` reads the httpOnly `ay_at` access cookie, verifies the HS256 JWT,
 *     loads the Session it names, rejects revoked/expired sessions and suspended or
 *     deleted users, and exposes `req.identity`.
 *  2. Role is taken from the database (User.role for account sessions, `member` for
 *     anonymous sessions) — a JWT claim is never trusted for authorization.
 *  3. `requireSession` / `requireUser` / `requireRole` gate routes.
 *
 * `loadIdentity` never throws: a missing, malformed or expired cookie simply leaves
 * `req.identity = null` so public routes keep working and the client can bootstrap a
 * session or call `/auth/refresh`.
 */
const logger = require('../config/logger');
const ApiError = require('../utils/ApiError');
const { verifyAccessToken } = require('../utils/tokens');
const { COOKIE_NAMES } = require('../utils/cookies');

const ROLES = new Set(['member', 'moderator', 'admin']);
const SESSION_SELECT = 'kind user alias expiresAt revokedAt lastSeenAt';
const USER_SELECT = 'role status displayName deletedAt';
const LAST_SEEN_THROTTLE_MS = 5 * 60 * 1000;

/**
 * Lazy model loading keeps middleware importable before the models are wired and
 * avoids require cycles between models and middleware.
 * @returns {{Session: import('mongoose').Model, User: import('mongoose').Model}}
 */
function getModels() {
  // eslint-disable-next-line global-require
  const Session = require('../models/Session');
  // eslint-disable-next-line global-require
  const User = require('../models/User');
  return { Session, User };
}

/**
 * @param {*} value
 * @returns {Date|null}
 */
function toDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * @param {*} session mongoose lean document
 * @param {{Session: import('mongoose').Model}} models
 * @param {import('express').Request} req
 * @returns {boolean} true when lastSeenAt was refreshed (or refresh was attempted)
 */
function touchLastSeen(session, models, req) {
  const now = Date.now();
  const lastSeen = toDate(session.lastSeenAt);
  if (lastSeen && now - lastSeen.getTime() < LAST_SEEN_THROTTLE_MS) return false;

  // Fire-and-forget: a failed telemetry write must never fail the request.
  Promise.resolve()
    .then(() => models.Session.updateOne({ _id: session._id }, { $set: { lastSeenAt: new Date(now) } }))
    .catch((error) => {
      logger.warn('Failed to update session lastSeenAt', {
        requestId: req.id,
        message: error.message,
      });
    });
  return true;
}

/**
 * Resolve the caller's identity from the access cookie.
 * Never throws; always calls next().
 * @param {import('express').Request} req
 * @param {import('express').Response} _res
 * @param {import('express').NextFunction} next
 * @returns {Promise<void>}
 */
async function loadIdentity(req, _res, next) {
  req.identity = null;

  const token = req.cookies && req.cookies[COOKIE_NAMES.access];
  if (typeof token !== 'string' || token.length === 0) return next();

  try {
    const claims = verifyAccessToken(token);
    const models = getModels();

    const session = await models.Session.findById(claims.sub).select(SESSION_SELECT).lean();

    // Reject revoked/expired sessions even if the JWT itself is still valid.
    if (session && !session.revokedAt && session.kind === claims.kind) {
      const expiresAt = toDate(session.expiresAt);
      const sessionUsable = !expiresAt || expiresAt.getTime() > Date.now();
      if (sessionUsable) {
        req.identity = await resolveIdentity({ claims, session, models, req });
      }
    }
  } catch (error) {
    // Deliberately quiet: an invalid token is normal traffic, not an error.
    logger.debug('Identity resolution failed', {
      requestId: req.id,
      message: error.message,
    });
    req.identity = null;
  }

  return next();
}

/**
 * Map a verified session (+ account, if any) to the frozen identity shape.
 * @param {{claims:object, session:object, models:object, req:import('express').Request}} input
 * @returns {Promise<object|null>}
 */
async function resolveIdentity({ claims, session, models, req }) {
  touchLastSeen(session, models, req);

  if (session.kind === 'user') {
    if (!session.user) return null;

    const user = await models.User.findOne({ _id: session.user, status: 'active' })
      .select(USER_SELECT)
      .lean();

    // Deleted/suspended accounts lose access immediately, even with a live session.
    if (!user || user.deletedAt) return null;
    if (!ROLES.has(user.role)) return null;
    // A token minted for a different account is never accepted.
    if (claims.uid && String(claims.uid) !== String(session.user)) return null;

    return {
      sessionId: String(session._id),
      kind: 'user',
      userId: String(session.user),
      role: user.role,
      alias: session.alias || user.displayName || null,
      session,
    };
  }

  return {
    sessionId: String(session._id),
    kind: 'anonymous',
    userId: null,
    role: 'member',
    alias: session.alias || null,
    session,
  };
}

/**
 * Require any identity (anonymous session or account).
 * @param {import('express').Request} req
 * @param {import('express').Response} _res
 * @param {import('express').NextFunction} next
 * @returns {void}
 */
function requireSession(req, _res, next) {
  if (!req.identity) {
    return next(ApiError.unauthorized('A session is required for this action'));
  }
  return next();
}

/**
 * Require an account session (signed-in user). Anonymous sessions get 401 so the
 * client can prompt for sign-in.
 * @param {import('express').Request} req
 * @param {import('express').Response} _res
 * @param {import('express').NextFunction} next
 * @returns {void}
 */
function requireUser(req, _res, next) {
  if (!req.identity) {
    return next(ApiError.unauthorized('Sign in is required for this action'));
  }
  if (req.identity.kind !== 'user') {
    return next(ApiError.unauthorized('Sign in is required for this action'));
  }
  return next();
}

/**
 * Require one of the given roles. Must be composed after an identity check on routes
 * that anonymous sessions cannot reach; it still fails closed on its own.
 * @param {...string} roles allowed roles
 * @returns {import('express').RequestHandler}
 */
function requireRole(...roles) {
  const allowed = roles.flat().filter((role) => ROLES.has(role));
  if (allowed.length === 0) {
    throw new TypeError('requireRole requires at least one of: member, moderator, admin');
  }

  return function requireRoleMiddleware(req, _res, next) {
    if (!req.identity) {
      return next(ApiError.unauthorized('Authentication is required for this action'));
    }
    if (!allowed.includes(req.identity.role)) {
      return next(ApiError.forbidden('You do not have permission to perform this action'));
    }
    return next();
  };
}

module.exports = {
  loadIdentity,
  requireSession,
  requireUser,
  requireRole,
};
