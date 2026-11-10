'use strict';

/**
 * Idempotent data bootstrap (ARCHITECTURE §10, scripts/seedBoards.js).
 *
 * - `seedBoards()` upserts the nine board definitions by slug. Seed-managed presentation
 *   fields are refreshed, but admin-managed counters (`threadCount`, `replyCount`,
 *   `lastActivityAt`) and `isActive` are never overwritten, so running it repeatedly is safe.
 * - `ensureAdminFromEnv()` creates the initial admin only when ADMIN_EMAIL/ADMIN_PASSWORD are
 *   configured and no account with that email exists. Passwords are never logged.
 */
const env = require('../config/env');
const logger = require('../config/logger');
const Board = require('../models/Board');
const User = require('../models/User');
const seededBoards = require('../data/boards.seed');

/** Board fields owned by the seed file; everything else is admin/runtime data. */
const SEED_MANAGED_FIELDS = [
  'name',
  'icon',
  'description',
  'supportLevel',
  'guidelines',
  'tags',
  'order',
];

/** Minimum admin password length; shared with scripts/createAdmin.js. */
const MIN_ADMIN_PASSWORD_LENGTH = 10;

/**
 * @param {unknown} existing
 * @param {unknown} desired
 * @returns {boolean} whether two seed-managed values are equivalent
 */
function sameSeedValue(existing, desired) {
  if (Array.isArray(existing) || Array.isArray(desired)) {
    return JSON.stringify(existing || []) === JSON.stringify(desired || []);
  }
  return existing === desired;
}

/**
 * Create missing boards and refresh seed-managed fields on existing ones.
 * Never touches counters, activity timestamps or activation state.
 * @returns {Promise<{total:number,created:number,updated:number,unchanged:number}>}
 */
async function seedBoards() {
  const summary = { total: seededBoards.length, created: 0, updated: 0, unchanged: 0 };

  for (const seedBoard of seededBoards) {
    const existing = await Board.findOne({ slug: seedBoard.slug });

    if (!existing) {
      await Board.create(seedBoard);
      summary.created += 1;
      continue;
    }

    const needsUpdate = SEED_MANAGED_FIELDS.some(
      (field) => !sameSeedValue(existing[field], seedBoard[field])
    );
    if (!needsUpdate) {
      summary.unchanged += 1;
      continue;
    }

    for (const field of SEED_MANAGED_FIELDS) {
      existing[field] = seedBoard[field];
    }
    await existing.save();
    summary.updated += 1;
  }

  logger.info('Board seeding complete', summary);
  return summary;
}

/**
 * Create the initial admin account from environment configuration.
 * Idempotent: an existing account with that email is left untouched.
 * @returns {Promise<{status:'created'|'exists'|'skipped', reason?:string, role?:string, userId?:string}>}
 */
async function ensureAdminFromEnv() {
  const email = String(env.adminEmail || '')
    .trim()
    .toLowerCase();
  const password = String(env.adminPassword || '');

  if (!email || !password) {
    logger.info('Admin bootstrap skipped: ADMIN_EMAIL/ADMIN_PASSWORD not configured');
    return { status: 'skipped', reason: 'not-configured' };
  }

  if (password.length < MIN_ADMIN_PASSWORD_LENGTH) {
    logger.warn('Admin bootstrap skipped: ADMIN_PASSWORD is shorter than the minimum length', {
      minLength: MIN_ADMIN_PASSWORD_LENGTH,
    });
    return { status: 'skipped', reason: 'weak-password' };
  }

  const existing = await User.findOne({ email }).select('+email');
  if (existing) {
    logger.info('Admin bootstrap skipped: account already exists', { role: existing.role });
    return { status: 'exists', role: existing.role };
  }

  // The User pre-save hook hashes `passwordHash` with bcrypt cost 12.
  const user = await User.create({
    email,
    passwordHash: password,
    role: 'admin',
    displayName: 'Administrator',
  });
  // Never log the email or password — the id is sufficient for audit correlation.
  logger.info('Admin account created from environment', { userId: String(user._id) });
  return { status: 'created', userId: String(user._id) };
}

module.exports = {
  seedBoards,
  ensureAdminFromEnv,
  MIN_ADMIN_PASSWORD_LENGTH,
  SEED_MANAGED_FIELDS,
};
