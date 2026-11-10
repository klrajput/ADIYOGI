'use strict';

/**
 * Identity helpers shared by every domain service.
 *
 * Ownership is always derived from the server-side session (`req.identity`) — never
 * from client-supplied ids (docs/ARCHITECTURE.md §6.4, §12.7):
 *  - accounts   → `identity.userId`
 *  - anonymous  → `identity.sessionId`
 *
 * @typedef {{
 *   sessionId: string|import('mongoose').Types.ObjectId,
 *   kind: 'anonymous'|'user',
 *   userId: string|import('mongoose').Types.ObjectId|null,
 *   role: 'member'|'moderator'|'admin',
 *   alias: string,
 *   session: object
 * }} Identity
 */

/**
 * @param {Identity|null|undefined} identity
 * @returns {boolean} true for signed-in accounts
 */
function isAccount(identity) {
  return Boolean(identity && identity.kind === 'user' && identity.userId);
}

/**
 * @param {Identity|null|undefined} identity
 * @returns {boolean} true for moderator and admin roles
 */
function isModerator(identity) {
  return Boolean(identity && (identity.role === 'moderator' || identity.role === 'admin'));
}

/**
 * @param {Identity|null|undefined} identity
 * @returns {boolean} true for the admin role
 */
function isAdmin(identity) {
  return Boolean(identity && identity.role === 'admin');
}

/**
 * The ownership id used for `authorId` / `reportedBy` / `ownerId` fields and for
 * `toPublicJSON({ viewerId })`.
 * @param {Identity} identity
 * @returns {string}
 */
function viewerIdOf(identity) {
  if (!identity) return '';
  return isAccount(identity) ? String(identity.userId) : String(identity.sessionId);
}

/**
 * The author fields stored on Thread/Reply documents at creation time.
 * @param {Identity} identity
 * @returns {{authorType:'anonymous'|'user', authorId:string, authorModel:'Session'|'User', authorAlias:string}}
 */
function authorFieldsOf(identity) {
  const account = isAccount(identity);
  return {
    authorType: account ? 'user' : 'anonymous',
    authorId: viewerIdOf(identity),
    authorModel: account ? 'User' : 'Session',
    authorAlias: identity.alias,
  };
}

/**
 * Options accepted by every model `toPublicJSON()` (§12.7).
 * @param {Identity|null|undefined} identity
 * @returns {{viewerId:string, isModerator:boolean}}
 */
function serializeOptionsOf(identity) {
  return { viewerId: viewerIdOf(identity), isModerator: isModerator(identity) };
}

/**
 * Notification recipient descriptor for an identity (recipientType is
 * `'session' | 'user'`, while Thread/Reply authorType is `'anonymous' | 'user'`).
 * @param {Identity} identity
 * @returns {{recipientType:'session'|'user', recipientId:string}}
 */
function recipientOf(identity) {
  return {
    recipientType: isAccount(identity) ? 'user' : 'session',
    recipientId: viewerIdOf(identity),
  };
}

/**
 * Notification recipient for a content author (used when notifying thread owners).
 * @param {{authorType:'anonymous'|'user', authorId:*}} document
 * @returns {{recipientType:'session'|'user', recipientId:string}}
 */
function recipientOfAuthor(document) {
  return {
    recipientType: document.authorType === 'user' ? 'user' : 'session',
    recipientId: String(document.authorId),
  };
}

module.exports = {
  isAccount,
  isModerator,
  isAdmin,
  viewerIdOf,
  authorFieldsOf,
  serializeOptionsOf,
  recipientOf,
  recipientOfAuthor,
};
