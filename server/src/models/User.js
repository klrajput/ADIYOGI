'use strict';

/**
 * User — account identity (member / moderator / admin).
 *
 * Password handling: assign the PLAINTEXT password to `passwordHash`; the pre-save hook
 * hashes it with bcrypt (cost 12) whenever the field is modified and records
 * `passwordChangedAt`. Mutating `passwordHash` through update operators bypasses the hook,
 * so password changes must always go through `document.save()`.
 *
 * Serialization (ARCHITECTURE §12.7):
 *  - `email` and `passwordHash` are `select: false`; queries that need them must opt in
 *    (`.select('+email +passwordHash')`).
 *  - `toPublicJSON()` emits the frozen User shape and is meant for the authenticated user
 *    or an admin-only view — no public endpoint returns another user's document.
 *  - `toJSON()` never emits `email`, `passwordHash`, `__v` or internal security counters.
 */
const bcrypt = require('bcryptjs');
const { Schema, model } = require('mongoose');

const BCRYPT_COST = 12;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const userSchema = new Schema(
  {
    email: {
      type: String,
      required: [true, 'email is required'],
      lowercase: true,
      trim: true,
      maxlength: [254, 'email must be 254 characters or fewer'],
      match: [EMAIL_PATTERN, 'email must be a valid address'],
      select: false,
    },
    // Bcrypt hash when persisted; callers assign the plaintext password and the hook hashes it.
    passwordHash: {
      type: String,
      required: [true, 'passwordHash is required'],
      minlength: [1, 'password must not be empty'],
      maxlength: 200,
      select: false,
    },
    role: {
      type: String,
      enum: {
        values: ['member', 'moderator', 'admin'],
        message: 'role must be one of member, moderator, admin',
      },
      default: 'member',
    },
    displayName: {
      type: String,
      required: [true, 'displayName is required'],
      trim: true,
      minlength: [2, 'displayName must be at least 2 characters'],
      maxlength: [40, 'displayName must be 40 characters or fewer'],
    },
    status: {
      type: String,
      enum: ['active', 'suspended'],
      default: 'active',
    },
    lastLoginAt: { type: Date, default: null },
    failedLoginAttempts: { type: Number, default: 0, min: 0 },
    lockedUntil: { type: Date, default: null },
    passwordChangedAt: { type: Date, default: null },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ role: 1 });

/**
 * Hash a newly supplied plaintext password. Existing bcrypt strings (e.g. fixtures created
 * by an operator with a pre-hashed value) are accepted as-is and never double-hashed.
 */
userSchema.pre('save', async function hashPassword() {
  if (!this.isModified('passwordHash')) return;
  if (/^\$2[aby]\$\d{2}\$/.test(this.passwordHash)) {
    this.passwordChangedAt = this.passwordChangedAt || new Date();
    return;
  }
  this.passwordHash = await bcrypt.hash(this.passwordHash, BCRYPT_COST);
  this.passwordChangedAt = new Date();
});

/**
 * Constant-time bcrypt comparison against the stored hash.
 * @param {string} candidate plaintext candidate password
 * @returns {Promise<boolean>}
 */
userSchema.methods.comparePassword = async function comparePassword(candidate) {
  if (!candidate || !this.passwordHash) return false;
  return bcrypt.compare(String(candidate), this.passwordHash);
};

/**
 * Look up an account that may authenticate, selecting the normally hidden email/hash.
 * Returns null for unknown, soft-deleted or suspended accounts; the caller applies lockout
 * policy (failedLoginAttempts / lockedUntil) so it can surface the right error.
 * @param {string} email
 * @param {string} password
 * @returns {Promise<object|null>} hydrated User
 */
userSchema.statics.findByCredentials = async function findByCredentials(email, password) {
  if (!email || !password) return null;
  const normalizedEmail = String(email).trim().toLowerCase();
  const user = await this.findOne({
    email: normalizedEmail,
    status: 'active',
    deletedAt: null,
  }).select('+email +passwordHash');
  if (!user) return null;
  const matches = await user.comparePassword(password);
  return matches ? user : null;
};

/**
 * Safe viewer-less projection (used by toJSON and as the base of toPublicJSON).
 * @returns {object}
 */
userSchema.methods.toSafeJSON = function toSafeJSON() {
  return {
    id: this._id ? String(this._id) : null,
    role: this.role,
    displayName: this.displayName,
    status: this.status,
    createdAt: this.createdAt,
  };
};

/**
 * Frozen §12.7 shape: `{id, email, role, displayName, status, createdAt}`.
 * Only serialize the authenticated user or an admin-only view with this.
 * @returns {object}
 */
userSchema.methods.toPublicJSON = function toPublicJSON() {
  return { ...this.toSafeJSON(), email: this.email || null };
};

userSchema.set('toJSON', {
  virtuals: false,
  transform(doc) {
    return doc.toSafeJSON();
  },
});

module.exports = model('User', userSchema);
