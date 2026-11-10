'use strict';

/**
 * Session — server-issued identity for anonymous visitors and logged-in accounts.
 *
 * The opaque refresh token is never stored: only `sha256(token)` in `tokenHash`
 * (ARCHITECTURE §6.2). The raw IP is never stored either — only an HMAC in `ipHash`.
 *
 * Serialization: sessions are never sent to clients (ARCHITECTURE §12.7). `toJSON()` /
 * `toPublicJSON()` still strip `tokenHash`, `ipHash` and the `user` ref defensively; the
 * auth controller builds the documented `identity` object itself.
 */
const { Schema, model } = require('mongoose');
const { sessionExpiry, publicJSONOptions } = require('./lib/helpers');

const sessionSchema = new Schema(
  {
    kind: {
      type: String,
      enum: ['anonymous', 'user'],
      required: true,
      default: 'anonymous',
    },
    // sha256(token) hex — unique so a token hash can never identify two sessions.
    tokenHash: {
      type: String,
      required: [true, 'tokenHash is required'],
      unique: true,
      select: false,
      minlength: [64, 'tokenHash must be a sha256 hex digest'],
      maxlength: [128, 'tokenHash is too long'],
    },
    user: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    alias: {
      type: String,
      required: [true, 'alias is required'],
      trim: true,
      minlength: [2, 'alias must be at least 2 characters'],
      maxlength: [40, 'alias must be 40 characters or fewer'],
    },
    // HMAC-SHA256(ip, SESSION_SECRET) — a raw IP is never stored or logged.
    ipHash: { type: String, trim: true, maxlength: 128, default: null },
    lastSeenAt: { type: Date, default: () => new Date() },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
    // Audit trail of token rotation: the session this one replaced.
    rotatedFrom: { type: Schema.Types.ObjectId, ref: 'Session', default: null },
  },
  { timestamps: true }
);

sessionSchema.index({ user: 1 });
// TTL: MongoDB removes expired sessions automatically (still check revokedAt in code).
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

sessionSchema.pre('validate', function setSessionExpiry(next) {
  if (!this.expiresAt) this.expiresAt = sessionExpiry();
  next();
});

/**
 * A session can be used for authentication only while it is neither revoked nor expired.
 * TTL deletion is asynchronous, so expiry must always be checked explicitly.
 * @param {object|null|undefined} session hydrated or plain Session document
 * @returns {boolean}
 */
sessionSchema.statics.isUsable = function isUsable(session) {
  if (!session) return false;
  if (session.revokedAt) return false;
  if (!session.expiresAt) return false;
  return new Date(session.expiresAt).getTime() > Date.now();
};

/**
 * Defensive public projection. Sessions are never serialized to clients; if one is ever
 * converted to JSON by accident, hashes and the account ref are omitted.
 * @returns {object}
 */
sessionSchema.methods.toPublicJSON = function toPublicJSON() {
  return {
    id: this._id ? String(this._id) : null,
    kind: this.kind,
    alias: this.alias,
    lastSeenAt: this.lastSeenAt,
    expiresAt: this.expiresAt,
    createdAt: this.createdAt,
  };
};

sessionSchema.set('toJSON', publicJSONOptions());

module.exports = model('Session', sessionSchema);
