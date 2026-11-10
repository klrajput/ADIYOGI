'use strict';

/**
 * Reply business rules for `/api/v1/threads/:id/replies` and `/api/v1/replies`
 * (docs/ARCHITECTURE.md §4.3, §4.4, §5).
 *
 * Replies are visible only while `published`; deletion is a soft delete so the
 * moderation audit trail stays intact. Reply creation notifies the thread author
 * (never including reply content) and updates both reply counters.
 */
const Reply = require('../models/Reply');
const Thread = require('../models/Thread');
const ModerationAction = require('../models/ModerationAction');
const logger = require('../config/logger');
const ApiError = require('../utils/ApiError');
const { getPagination, buildMeta } = require('../utils/pagination');
const { stripHtml, containsBlockedTerms } = require('../middleware/sanitize');
const counterService = require('./counterService');
const crisisSignalService = require('./crisisSignalService');
const notificationService = require('./notificationService');
const threadService = require('./threadService');
const { viewerIdOf, isModerator, serializeOptionsOf, authorFieldsOf } = require('../utils/domain/identity');

const REPLY_SORTS = Object.freeze({
  old: { createdAt: 1 },
  new: { createdAt: -1 },
});

/**
 * Strip HTML from reply prose while preserving paragraph breaks.
 * @param {string} value
 * @returns {string}
 */
function cleanReplyBody(value) {
  return stripHtml(value)
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .trim()
    .slice(0, 3000);
}

/**
 * Paginated published replies for a visible thread.
 * @param {{threadId: string, identity: object|null, query: object}} input
 * @returns {Promise<{replies: object[], meta: object}>}
 */
async function listReplies({ threadId, identity, query }) {
  const thread = await threadService.loadVisibleThread(threadId, identity);
  const { page, limit, skip } = getPagination(query);
  const sort = REPLY_SORTS[query.sort] || REPLY_SORTS.old;
  const filter = { thread: thread._id, status: 'published' };
  const options = serializeOptionsOf(identity);

  const [documents, total] = await Promise.all([
    Reply.find(filter).sort(sort).skip(skip).limit(limit),
    Reply.countDocuments(filter),
  ]);

  return {
    replies: documents.map((document) => document.toPublicJSON(options)),
    meta: buildMeta({ page, limit, total }),
  };
}

/**
 * Create a reply on a published, unlocked thread.
 * @param {{threadId: string, identity: object, input: object, country?: string|null}} input
 * @returns {Promise<{reply: object, support: object|null}>}
 */
async function createReply({ threadId, identity, input, country }) {
  const thread = await threadService.loadVisibleThread(threadId, identity);
  if (thread.status !== 'published') throw ApiError.notFound('Thread not found');
  if (thread.isLocked) throw ApiError.forbidden('This thread is locked');

  const body = cleanReplyBody(input.body);
  if (containsBlockedTerms(body)) {
    throw ApiError.unprocessable('CONTENT_BLOCKED', 'This content violates our community guidelines');
  }

  const reply = await Reply.create({
    thread: thread._id,
    body,
    contentWarning: Boolean(input.contentWarning),
    ...authorFieldsOf(identity),
    status: 'published',
  });

  await counterService.onReplyCreated(thread._id, thread.boardSlug);
  await notificationService.notifyThreadReply({ thread, reply, actor: identity });

  const assessment = await crisisSignalService.assessContent(body);
  await crisisSignalService.recordIfElevated({ sessionId: String(identity.sessionId), assessment, country });

  return { reply, support: crisisSignalService.supportFor(assessment) };
}

/**
 * Soft-delete a reply (author or moderator) and keep both counters consistent.
 * @param {{id: string, identity: object}} input
 * @returns {Promise<void>}
 */
async function deleteReply({ id, identity }) {
  const reply = await Reply.findById(id);
  if (!reply || reply.status === 'deleted') throw ApiError.notFound('Reply not found');

  const owner = String(reply.authorId) === viewerIdOf(identity);
  const moderator = isModerator(identity);
  if (!owner && !moderator) throw ApiError.forbidden('You are not allowed to delete this reply');

  const thread = await Thread.findById(reply.thread).select('_id boardSlug status');
  if (!thread) throw ApiError.notFound('Thread not found');

  reply.status = 'deleted';
  reply.deletedAt = new Date();
  if (moderator) {
    reply.moderatedBy = identity.userId || null;
    reply.moderationReason = 'Reply removed by moderator';
  }
  await reply.save();
  await counterService.onReplyRemoved(thread._id, thread.boardSlug);

  if (moderator) {
    await ModerationAction.create({
      moderator: identity.userId,
      action: 'delete',
      targetType: 'reply',
      targetId: reply._id,
      reportId: null,
      reason: 'Reply deleted by moderator',
    });
  } else {
    logger.debug('reply.deleted_by_author', { replyId: String(reply._id) });
  }
}

module.exports = { REPLY_SORTS, cleanReplyBody, listReplies, createReply, deleteReply };
