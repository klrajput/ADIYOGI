'use strict';

/**
 * Shared helpers for the Mongoose models.
 *
 * Serialization policy (ARCHITECTURE §5 + §12.7):
 *  - `toPublicJSON(options)` is the ONLY representation a browser may receive;
 *  - `toJSON()` is wired to the same viewer-less public projection, so an accidental
 *    `res.json(document)` can never leak internal identity refs, hashes or `__v`;
 *  - identity references (`authorId`, `authorModel`, `moderatedBy`, `ownerId`,
 *    `recipientId`, `reportedBy`, `session`, `tokenHash`, `passwordHash`, `email`,
 *    `ipHash`) are never emitted by a public projection.
 */
const env = require('../../config/env');

/** How long after creation an author keeps edit rights (ARCHITECTURE §4.3 / §12.7). */
const EDIT_WINDOW_MS = 15 * 60 * 1000;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Notifications are retained for 90 days (ARCHITECTURE §5 — TTL 90d). */
const NOTIFICATION_RETENTION_DAYS = 90;

/**
 * Convert a ref field (`ObjectId`, a populated document, or a string) to a plain id string.
 * @param {*} value
 * @returns {string|null}
 */
function refId(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'object' && value._id !== undefined) return String(value._id);
  return String(value);
}

/**
 * Compare a stored ownership id with the caller's identity id.
 * `viewerId` is `identity.userId` for accounts and `identity.sessionId` for anonymous
 * sessions (ARCHITECTURE §12.7), always compared as strings.
 * @param {*} ownerId
 * @param {*} viewerId
 * @returns {boolean}
 */
function viewerOwns(ownerId, viewerId) {
  if (ownerId === null || ownerId === undefined || viewerId === null || viewerId === undefined) {
    return false;
  }
  return String(ownerId) === String(viewerId);
}

/**
 * Moderators/admins may delete content they do not own. Controllers pass either
 * `isModerator: true` (preferred) or `role: 'moderator'|'admin'`.
 * @param {object} options
 * @returns {boolean}
 */
function viewerIsPrivileged(options = {}) {
  if (options.isModerator === true || options.isPrivileged === true) return true;
  return options.role === 'moderator' || options.role === 'admin';
}

/**
 * Whether content is still inside the 15-minute author edit window.
 * @param {Date|string|number|undefined|null} createdAt
 * @param {Date} [now]
 * @returns {boolean}
 */
function isWithinEditWindow(createdAt, now = new Date()) {
  if (!createdAt) return false;
  const createdMs = createdAt instanceof Date ? createdAt.getTime() : new Date(createdAt).getTime();
  if (Number.isNaN(createdMs)) return false;
  return now.getTime() - createdMs <= EDIT_WINDOW_MS;
}

/**
 * Normalise a tag array: trimmed, lowercased, de-duplicated, empty entries dropped.
 * @param {unknown} values
 * @returns {string[]}
 */
function normalizeTags(values) {
  if (!Array.isArray(values)) return [];
  const normalized = values.map((value) => String(value).trim().toLowerCase()).filter(Boolean);
  return Array.from(new Set(normalized));
}

/**
 * Derive a plain-text excerpt from a thread body. Whitespace is collapsed so newlines
 * never leak into list views; the cut happens on a word boundary where possible.
 * @param {unknown} text
 * @param {number} [maxLength]
 * @returns {string}
 */
function deriveExcerpt(text, maxLength = 200) {
  const normalized = String(text || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (normalized.length <= maxLength) return normalized;
  const hardCut = normalized.slice(0, maxLength - 1);
  const lastSpace = hardCut.lastIndexOf(' ');
  const cut = lastSpace > maxLength * 0.6 ? hardCut.slice(0, lastSpace) : hardCut;
  return `${cut.trimEnd()}…`;
}

/**
 * @param {Date} from
 * @param {number} days
 * @returns {Date}
 */
function addDays(from, days) {
  return new Date(from.getTime() + days * DAY_MS);
}

/**
 * Session lifetime from `SESSION_TTL_DAYS` (ARCHITECTURE §6.2).
 * @param {Date} [now]
 * @returns {Date}
 */
function sessionExpiry(now = new Date()) {
  return addDays(now, env.sessionTtlDays);
}

/**
 * Chat retention TTL from `CHAT_RETENTION_DAYS` (ARCHITECTURE §7 / §9).
 * @param {Date} [now]
 * @returns {Date}
 */
function chatExpiry(now = new Date()) {
  return addDays(now, env.retention.chatDays);
}

/**
 * Crisis-event retention TTL from `CRISIS_EVENT_RETENTION_DAYS` (ARCHITECTURE §5 / §9).
 * @param {Date} [now]
 * @returns {Date}
 */
function crisisExpiry(now = new Date()) {
  return addDays(now, env.retention.crisisDays);
}

/**
 * Notification retention TTL (fixed 90 days, ARCHITECTURE §5).
 * @param {Date} [now]
 * @returns {Date}
 */
function notificationExpiry(now = new Date()) {
  return addDays(now, NOTIFICATION_RETENTION_DAYS);
}

/**
 * Mongoose `toJSON` option that delegates to the document's `toPublicJSON()`.
 * Every model implements that instance method, so its JSON form is always the safe,
 * viewer-less public projection.
 * @returns {object}
 */
function publicJSONOptions() {
  return {
    virtuals: false,
    transform(doc) {
      return doc.toPublicJSON();
    },
  };
}

module.exports = {
  EDIT_WINDOW_MS,
  NOTIFICATION_RETENTION_DAYS,
  refId,
  viewerOwns,
  viewerIsPrivileged,
  isWithinEditWindow,
  normalizeTags,
  deriveExcerpt,
  addDays,
  sessionExpiry,
  chatExpiry,
  crisisExpiry,
  notificationExpiry,
  publicJSONOptions,
};
