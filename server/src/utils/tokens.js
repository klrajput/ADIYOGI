'use strict';

/**
 * Token primitives (docs/ARCHITECTURE.md §6.2, §12.2).
 *
 * Access tokens are short-lived HS256 JWTs carried in an httpOnly cookie.
 * Refresh tokens and CSRF tokens are opaque random values; refreshing tokens are
 * persisted only as SHA-256 hashes (Session.tokenHash). CSRF tokens are additionally
 * HMAC-signed with SESSION_SECRET so a forged/substituted cookie cannot satisfy the
 * double-submit check by itself.
 */
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const env = require('../config/env');

const JWT_ALGORITHM = 'HS256';
const JWT_ISSUER = 'adiyogi';
const JWT_AUDIENCE = 'adiyogi-web';
const KINDS = new Set(['anonymous', 'user']);
const ROLES = new Set(['member', 'moderator', 'admin']);

/**
 * Fail closed: never sign or hash with an empty secret.
 * @returns {string} validated JWT secret
 */
function jwtSecret() {
  if (!env.jwtSecret) throw new Error('JWT_SECRET is not configured');
  return env.jwtSecret;
}

/**
 * @returns {string} validated session/CSRF secret
 */
function sessionSecret() {
  if (!env.sessionSecret) throw new Error('SESSION_SECRET is not configured');
  return env.sessionSecret;
}

/**
 * Build a clean error for invalid tokens. The message deliberately hides the
 * underlying jsonwebtoken reason (expired vs malformed vs wrong key) so callers
 * cannot use error text as an oracle and logs do not leak token internals.
 * @returns {Error}
 */
function invalidAccessToken() {
  const error = new Error('Invalid or expired access token');
  error.name = 'TokenVerificationError';
  error.code = 'INVALID_ACCESS_TOKEN';
  return error;
}

/**
 * Sign a short-lived access token.
 *
 * Emitted claims are only `{ sub, kind, role, uid? }` (plus standard iss/aud/exp/iat).
 * @param {{sub:string, kind:'anonymous'|'user', role:'member'|'moderator'|'admin', uid?:string}} payload
 * @returns {string} compact JWT
 */
function signAccessToken(payload = {}) {
  const { sub, kind, role, uid } = payload || {};

  if (typeof sub !== 'string' || sub.length === 0) {
    throw new TypeError('signAccessToken requires a non-empty string `sub` (session id)');
  }
  if (!KINDS.has(kind)) {
    throw new TypeError("signAccessToken requires `kind` to be 'anonymous' or 'user'");
  }
  if (!ROLES.has(role)) {
    throw new TypeError("signAccessToken requires `role` to be 'member', 'moderator' or 'admin'");
  }
  if (uid !== undefined && (typeof uid !== 'string' || uid.length === 0)) {
    throw new TypeError('signAccessToken `uid` must be a non-empty string when provided');
  }

  const claims = { kind, role };
  if (uid !== undefined) claims.uid = uid;

  return jwt.sign(claims, jwtSecret(), {
    algorithm: JWT_ALGORITHM,
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
    subject: sub,
    expiresIn: env.accessTokenTtlMin * 60,
  });
}

/**
 * Verify an access token and return only the contract claims.
 * Throws a generic Error (`code: 'INVALID_ACCESS_TOKEN'`) on any failure.
 * @param {string} token
 * @returns {{sub:string, kind:string, role:string, uid?:string}}
 */
function verifyAccessToken(token) {
  if (typeof token !== 'string' || token.length === 0) throw invalidAccessToken();

  let decoded;
  try {
    decoded = jwt.verify(token, jwtSecret(), {
      algorithms: [JWT_ALGORITHM],
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    });
  } catch {
    // Intentionally swallow the jsonwebtoken error: never surface `TokenExpiredError`
    // / `JsonWebTokenError` details to callers or logs.
    throw invalidAccessToken();
  }

  if (!decoded || typeof decoded !== 'object') throw invalidAccessToken();
  if (typeof decoded.sub !== 'string' || decoded.sub.length === 0) throw invalidAccessToken();
  if (!KINDS.has(decoded.kind)) throw invalidAccessToken();
  if (!ROLES.has(decoded.role)) throw invalidAccessToken();
  if (decoded.uid !== undefined && typeof decoded.uid !== 'string') throw invalidAccessToken();

  return {
    sub: decoded.sub,
    kind: decoded.kind,
    role: decoded.role,
    ...(decoded.uid !== undefined ? { uid: decoded.uid } : {}),
  };
}

/**
 * Generate an unguessable opaque token (refresh token or raw CSRF secret).
 * @param {number} [bytes=32] number of random bytes
 * @returns {string} base64url-encoded token
 */
function generateOpaqueToken(bytes = 32) {
  const size = Number.isInteger(bytes) && bytes > 0 && bytes <= 128 ? bytes : 32;
  return crypto.randomBytes(size).toString('base64url');
}

/**
 * Hash a token for at-rest storage (refresh tokens are never stored in plaintext).
 * @param {string} token
 * @returns {string} sha256 hex digest
 */
function hashToken(token) {
  if (typeof token !== 'string' || token.length === 0) {
    throw new TypeError('hashToken requires a non-empty string token');
  }
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * HMAC-SHA256 digest of a value using SESSION_SECRET.
 * @param {string} value
 * @returns {string} base64url digest
 */
function hmacSha256(value) {
  return crypto.createHmac('sha256', sessionSecret()).update(value).digest('base64url');
}

/**
 * Sign a CSRF secret into the `<raw>.<hmac>` double-submit token stored in the
 * readable `ay_csrf` cookie.
 * @param {string} raw opaque token generated by generateOpaqueToken
 * @returns {string}
 */
function signCsrfToken(raw) {
  if (typeof raw !== 'string' || raw.length === 0) {
    throw new TypeError('signCsrfToken requires a non-empty raw token');
  }
  return `${raw}.${hmacSha256(raw)}`;
}

/**
 * Verify the HMAC portion of a signed CSRF token. Malformed input is rejected
 * safely (never throws, never leaks timing via early-exit comparison on the MAC).
 * @param {string} signed
 * @returns {boolean}
 */
function verifyCsrfToken(signed) {
  if (typeof signed !== 'string' || signed.length === 0) return false;

  const separator = signed.lastIndexOf('.');
  // Exactly one separator, with a non-empty raw part and MAC part.
  if (separator <= 0 || separator !== signed.indexOf('.')) return false;
  if (separator === signed.length - 1) return false;

  const raw = signed.slice(0, separator);
  const provided = signed.slice(separator + 1);

  let expected;
  try {
    expected = hmacSha256(raw);
  } catch {
    return false;
  }

  const providedBuffer = Buffer.from(provided, 'utf8');
  const expectedBuffer = Buffer.from(expected, 'utf8');
  if (providedBuffer.length !== expectedBuffer.length) return false;
  return crypto.timingSafeEqual(providedBuffer, expectedBuffer);
}

module.exports = {
  signAccessToken,
  verifyAccessToken,
  generateOpaqueToken,
  hashToken,
  signCsrfToken,
  verifyCsrfToken,
};
