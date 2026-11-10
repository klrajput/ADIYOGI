'use strict';

/**
 * Account-level operations for `/api/v1/users` (docs/ARCHITECTURE.md §4.3, §4.4, §5).
 *
 * Owns preference upserts, the "my content" listings and the complete
 * "delete my data" cascade (hard delete of the requester's content, conversations,
 * messages, notifications, preferences, reports and sessions).
 */
const User = require('../models/User');
const Session = require('../models/Session');
const UserPreference = require('../models/UserPreference');
const Thread = require('../models/Thread');
const Reply = require('../models/Reply');
const Report = require('../models/Report');
const Notification = require('../models/Notification');
const Conversation = require('../models/Conversation');
const ChatMessage = require('../models/ChatMessage');
const CrisisEvent = require('../models/CrisisEvent');
const logger = require('../config/logger');
const ApiError = require('../utils/ApiError');
const { getPagination, buildMeta } = require('../utils/pagination');
const { hashToken } = require('../utils/tokens');
const counterService = require('./counterService');
const { viewerIdOf, serializeOptionsOf, isAccount } = require('../utils/domain/identity');

/**
 * Owner reference for a preference document.
 * @param {{session: object, user: object|null}} context
 * @returns {{ownerType:'session'|'user', ownerId:string}}
 */
function ownerRefOf(context) {
  const account = Boolean(context.user);
  return {
    ownerType: account ? 'user' : 'session',
    ownerId: String(account ? context.user._id : context.session._id),
  };
}

/**
 * Create the preference document for an identity if it does not exist yet.
 * @param {{session: object, user: object|null}} context
 * @returns {Promise<object>} UserPreference document
 */
async function ensurePreference({ session, user }) {
  const { ownerType, ownerId } = ownerRefOf({ session, user });
  const seed = {
    ownerType,
    ownerId,
    displayAlias: session.alias,
    showCrisisBar: true,
    contentWarningDefault: false,
    reduceMotion: false,
  };

  try {
    return await UserPreference.findOneAndUpdate(
      { ownerType, ownerId },
      { $setOnInsert: seed },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
  } catch (error) {
    // Concurrent first requests for the same identity race on the unique index.
    if (error && error.code === 11000) {
      const existing = await UserPreference.findOne({ ownerType, ownerId });
      if (existing) return existing;
    }
    throw error;
  }
}

/**
 * @param {object} context auth context
 * @returns {Promise<object>} public preference shape (§12.7)
 */
async function getPreferences(context) {
  const preference = context.preferences || (await ensurePreference(context));
  return preference.toPublicJSON();
}

/**
 * Patch the caller's preferences (upsert keeps preference-less legacy sessions working).
 * @param {object} context auth context
 * @param {object} patch validated fields
 * @returns {Promise<object>} public preference shape
 */
async function updatePreferences(context, patch) {
  const { ownerType, ownerId } = ownerRefOf(context);
  const update = { ...patch };
  if (update.displayAlias) update.displayAlias = update.displayAlias.trim();

  try {
    const preference = await UserPreference.findOneAndUpdate(
      { ownerType, ownerId },
      { $set: update, $setOnInsert: { ownerType, ownerId } },
      { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true }
    );
    return preference.toPublicJSON();
  } catch (error) {
    if (error && error.code === 11000) {
      const preference = await UserPreference.findOneAndUpdate(
        { ownerType, ownerId },
        { $set: update },
        { new: true, runValidators: true }
      );
      if (!preference) throw ApiError.internal('Could not save preferences');
      return preference.toPublicJSON();
    }
    throw error;
  }
}

/**
 * Paginated listing of the caller's own threads or replies (any status: the author
 * may see their own hidden/deleted content here, but never in public lists).
 * @param {{identity: object, type:'threads'|'replies', query: object}} input
 * @returns {Promise<{items: object[], meta: object}>}
 */
async function listOwnContent({ identity, type, query }) {
  const viewerId = viewerIdOf(identity);
  const { page, limit, skip } = getPagination(query);
  const viewerOptions = serializeOptionsOf(identity);

  if (type === 'replies') {
    const filter = { authorId: viewerId };
    const [documents, total] = await Promise.all([
      Reply.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Reply.countDocuments(filter),
    ]);
    return { items: documents.map((doc) => doc.toPublicJSON(viewerOptions)), meta: buildMeta({ page, limit, total }) };
  }

  const filter = { authorId: viewerId };
  const [documents, total] = await Promise.all([
    Thread.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Thread.countDocuments(filter),
  ]);
  return { items: documents.map((doc) => doc.toPublicJSON(viewerOptions)), meta: buildMeta({ page, limit, total }) };
}

/**
 * Group board counter deltas for a set of removed threads/replies.
 * @param {Map<string, {threadCount:number, replyCount:number}>} perSlug
 * @param {string} slug
 * @param {{threadCount?:number, replyCount?:number}} delta
 * @returns {void}
 */
function addBoardDelta(perSlug, slug, delta) {
  if (!slug) return;
  const current = perSlug.get(slug) || { threadCount: 0, replyCount: 0 };
  current.threadCount += delta.threadCount || 0;
  current.replyCount += delta.replyCount || 0;
  perSlug.set(slug, current);
}

/**
 * Complete data deletion for the caller (§6, §8): hard-deletes content owned by the
 * identity, cascades replies, conversations/messages, notifications, reports,
 * preferences and crisis metadata, then revokes sessions and deletes the account row.
 * Only a session-id hash is logged — never content, alias or email.
 *
 * @param {{identity: object, deleteContent?: boolean}} input
 * @returns {Promise<{accountDeleted: boolean, contentDeleted: boolean}>}
 */
async function deleteAccount({ identity, deleteContent = true }) {
  const viewerId = viewerIdOf(identity);
  const sessionId = String(identity.sessionId);
  const accountId = isAccount(identity) ? String(identity.userId) : null;
  const ownerType = accountId ? 'user' : 'session';
  const ownerId = accountId || sessionId;
  const at = new Date();
  const summary = { threads: 0, replies: 0, conversations: 0, messages: 0, notifications: 0, reports: 0 };

  if (deleteContent) {
    const perSlug = new Map();

    // 1. Threads authored by the caller (+ every reply attached to them).
    const threads = await Thread.find({ authorId: viewerId }).select('_id boardSlug replyCount').lean();
    const threadIds = threads.map((thread) => thread._id);
    if (threadIds.length > 0) {
      const cascaded = await Reply.deleteMany({ thread: { $in: threadIds } });
      summary.replies += cascaded.deletedCount || 0;
      for (const thread of threads) {
        addBoardDelta(perSlug, thread.boardSlug, {
          threadCount: -1,
          replyCount: -(Number(thread.replyCount) || 0),
        });
      }
    }

    // 2. The caller's own replies on other people's threads.
    const ownReplies = await Reply.find({ authorId: viewerId }).select('_id thread').lean();
    const externalReplies = ownReplies.filter((reply) => !threadIds.some((id) => String(id) === String(reply.thread)));
    summary.replies += externalReplies.length;
    if (externalReplies.length > 0) {
      const countsByThread = new Map();
      for (const reply of externalReplies) {
        const key = String(reply.thread);
        countsByThread.set(key, (countsByThread.get(key) || 0) + 1);
      }
      const parentThreads = await Thread.find({ _id: { $in: [...countsByThread.keys()] } })
        .select('boardSlug')
        .lean();
      for (const parent of parentThreads) {
        addBoardDelta(perSlug, parent.boardSlug, { replyCount: -countsByThread.get(String(parent._id)) });
      }
      await Reply.deleteMany({ authorId: viewerId });
    }

    summary.threads = threadIds.length;
    if (threadIds.length > 0) await Thread.deleteMany({ _id: { $in: threadIds } });

    await counterService.applyBoardDeltas(Object.fromEntries(perSlug));
  }

  // 3. Conversations + messages.
  const conversations = await Conversation.find({ ownerType, ownerId }).select('_id').lean();
  const conversationIds = conversations.map((conversation) => conversation._id);
  summary.conversations = conversationIds.length;
  if (conversationIds.length > 0) {
    const messages = await ChatMessage.deleteMany({ conversation: { $in: conversationIds } });
    summary.messages = messages.deletedCount || 0;
    await Conversation.deleteMany({ _id: { $in: conversationIds } });
  }

  // 4. Notifications addressed to the caller.
  const notifications = await Notification.deleteMany({ recipientType: ownerType, recipientId: ownerId });
  summary.notifications = notifications.deletedCount || 0;

  // 5. Every session id that has ever represented this identity (reports are attributed
  //    to the session they were filed from, not to the account id).
  const sessionIds = [sessionId];
  if (accountId) {
    const accountSessions = await Session.find({ user: accountId }).select('_id').lean();
    for (const session of accountSessions) sessionIds.push(String(session._id));
  }

  // 6. Reports authored by the caller and crisis metadata referencing their sessions.
  const reports = await Report.deleteMany({ reportedBy: { $in: sessionIds } });
  summary.reports = reports.deletedCount || 0;
  await CrisisEvent.deleteMany({ session: { $in: sessionIds } });

  // 7. Preferences.
  await UserPreference.deleteMany({ ownerType, ownerId });

  // 8. Sessions: revoke for accounts (audit trail), hard-delete for anonymous sessions.
  if (accountId) {
    await Session.updateMany({ user: accountId }, { $set: { revokedAt: at } });
  } else {
    await Session.deleteMany({ _id: sessionId });
  }

  // 9. The account row itself.
  let accountDeleted = false;
  if (accountId) {
    const removed = await User.findByIdAndDelete(accountId);
    accountDeleted = Boolean(removed);
  }

  logger.info('account.data_deleted', {
    sessionHash: hashToken(sessionId).slice(0, 12),
    kind: accountId ? 'user' : 'anonymous',
    contentDeleted: Boolean(deleteContent),
    ...summary,
  });

  return { accountDeleted, contentDeleted: Boolean(deleteContent) };
}

module.exports = {
  ensurePreference,
  getPreferences,
  updatePreferences,
  listOwnContent,
  deleteAccount,
};
