'use strict';

/**
 * Moderation business rules for `/api/v1/moderation` (docs/ARCHITECTURE.md §4.3, §4.4).
 *
 * Every state-changing action is validated against an action/target compatibility
 * matrix, applied to the target document, and audited as a ModerationAction. The queue
 * never exposes reporter identity and the stats endpoint returns aggregate counts only
 * (no crisis content — crisis events store metadata only by design).
 */
const Thread = require('../models/Thread');
const Reply = require('../models/Reply');
const Report = require('../models/Report');
const ModerationAction = require('../models/ModerationAction');
const CrisisEvent = require('../models/CrisisEvent');
const ApiError = require('../utils/ApiError');
const { getPagination, buildMeta } = require('../utils/pagination');
const counterService = require('./counterService');
const reportService = require('./reportService');
const { serializeOptionsOf } = require('../utils/domain/identity');

/** Which moderation actions are valid for each target type. */
const ACTION_MATRIX = Object.freeze({
  thread: Object.freeze(['hide', 'unhide', 'delete', 'pin', 'unpin', 'lock', 'unlock']),
  reply: Object.freeze(['hide', 'unhide', 'delete']),
});

/** Actions that take content away from the public and require a written reason. */
const DESTRUCTIVE_ACTIONS = Object.freeze(['hide', 'delete']);

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * @param {Date} [now]
 * @returns {Date} start of the current UTC day
 */
function startOfDay(now = new Date()) {
  const start = new Date(now);
  start.setUTCHours(0, 0, 0, 0);
  return start;
}

/**
 * Validate that an action applies to a target type.
 * @param {string} action
 * @param {string} targetType
 * @returns {void}
 */
function assertCompatible(action, targetType) {
  const allowed = ACTION_MATRIX[targetType];
  if (!allowed || !allowed.includes(action)) {
    throw ApiError.badRequest(
      'VALIDATION_ERROR',
      `Action "${action}" is not supported for target type "${targetType}"`
    );
  }
}

/**
 * Load a moderation target or throw NOT_FOUND.
 * @param {'thread'|'reply'} targetType
 * @param {string} targetId
 * @returns {Promise<object>} target document
 */
async function loadTarget(targetType, targetId) {
  const model = targetType === 'thread' ? Thread : Reply;
  const target = await model.findById(targetId);
  if (!target) throw ApiError.notFound(`${targetType === 'thread' ? 'Thread' : 'Reply'} not found`);
  return target;
}

/**
 * Moderator work queue: open/reviewing reports plus hidden content.
 * @param {{query: object}} input
 * @returns {Promise<{reports: object[], hiddenThreads: object[], hiddenReplies: object[], meta: object}>}
 */
async function getQueue({ query }) {
  const { page, limit, skip } = getPagination(query);
  const reportFilter = { status: { $in: ['open', 'reviewing'] } };
  const moderatorOptions = { viewerId: '', isModerator: true };

  const [reports, reportTotal, hiddenThreads, hiddenThreadTotal, hiddenReplies, hiddenReplyTotal] = await Promise.all([
    Report.find(reportFilter).sort({ createdAt: 1 }).skip(skip).limit(limit),
    Report.countDocuments(reportFilter),
    Thread.find({ status: 'hidden' }).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Thread.countDocuments({ status: 'hidden' }),
    Reply.find({ status: 'hidden' }).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Reply.countDocuments({ status: 'hidden' }),
  ]);

  return {
    reports: await reportService.enrichReports(reports),
    hiddenThreads: hiddenThreads.map((document) => document.toPublicJSON(moderatorOptions)),
    hiddenReplies: hiddenReplies.map((document) => document.toPublicJSON(moderatorOptions)),
    meta: {
      reports: buildMeta({ page, limit, total: reportTotal }),
      hiddenThreads: buildMeta({ page, limit, total: hiddenThreadTotal }),
      hiddenReplies: buildMeta({ page, limit, total: hiddenReplyTotal }),
    },
  };
}

/**
 * Apply a moderation action, audit it, and optionally resolve its report.
 * @param {{identity: object, input: object}} params
 * @returns {Promise<{moderationAction: object, target: object}>}
 */
async function createAction({ identity, input }) {
  assertCompatible(input.action, input.targetType);

  if (DESTRUCTIVE_ACTIONS.includes(input.action) && (!input.reason || input.reason.trim().length < 3)) {
    throw ApiError.badRequest('VALIDATION_ERROR', 'A reason is required for hide and delete actions');
  }

  const target = await loadTarget(input.targetType, input.targetId);
  const isThread = input.targetType === 'thread';
  const fromStatus = target.status;
  const now = new Date();

  if (target.status === 'deleted' && input.action !== 'delete') {
    throw ApiError.badRequest('VALIDATION_ERROR', 'Cannot modify content that has been deleted');
  }

  switch (input.action) {
    case 'hide': {
      if (target.status !== 'published') {
        throw ApiError.badRequest('VALIDATION_ERROR', 'Only published content can be hidden');
      }
      target.status = 'hidden';
      break;
    }
    case 'unhide': {
      if (target.status !== 'hidden') {
        throw ApiError.badRequest('VALIDATION_ERROR', 'Only hidden content can be unhidden');
      }
      target.status = 'published';
      break;
    }
    case 'delete': {
      if (target.status !== 'published' && target.status !== 'hidden') {
        throw ApiError.badRequest('VALIDATION_ERROR', 'Content is already deleted');
      }
      target.status = 'deleted';
      target.deletedAt = now;
      break;
    }
    case 'pin':
    case 'unpin': {
      if (!isThread) throw ApiError.badRequest('VALIDATION_ERROR', 'Only threads can be pinned');
      target.isPinned = input.action === 'pin';
      break;
    }
    case 'lock':
    case 'unlock': {
      if (!isThread) throw ApiError.badRequest('VALIDATION_ERROR', 'Only threads can be locked');
      target.isLocked = input.action === 'lock';
      break;
    }
    default:
      // assertCompatible() already rejected unknown actions.
      throw ApiError.badRequest('VALIDATION_ERROR', 'Unsupported moderation action');
  }

  if (input.action === 'delete') {
    target.moderatedBy = identity.userId || null;
    target.moderationReason = input.reason;
  } else if (input.action === 'hide' || input.action === 'unhide') {
    target.moderatedBy = identity.userId || null;
    target.moderationReason = input.reason || null;
  }

  await target.save();

  if (isThread && (input.action === 'delete' || input.action === 'hide')) {
    if (input.action === 'delete') await counterService.onThreadRemoved(target.board, target.replyCount);
  }
  if (!isThread && input.action === 'delete') {
    const thread = await Thread.findById(target.thread).select('_id boardSlug');
    if (thread) await counterService.onReplyRemoved(thread._id, thread.boardSlug);
  }

  let report = null;
  if (input.reportId) {
    report = await Report.findById(input.reportId);
    if (!report) throw ApiError.notFound('Report not found');
    report.status = 'resolved';
    if (identity.userId) report.reviewedBy = identity.userId;
    report.reviewedAt = now;
    report.resolutionNote = input.reason || `Moderation action: ${input.action}`;
    await report.save();
  }

  const moderationAction = await ModerationAction.create({
    moderator: identity.userId,
    action: input.action,
    targetType: input.targetType,
    targetId: target._id,
    reportId: report ? report._id : null,
    reason: input.reason || `Moderation action: ${input.action}`,
    metadata: {
      fromStatus,
      toStatus: target.status,
      ...(input.reportId ? { reportId: String(input.reportId) } : {}),
    },
  });

  return {
    moderationAction,
    target: target.toPublicJSON(serializeOptionsOf(identity)),
  };
}

/**
 * Paginated moderation audit log.
 * @param {{query: object}} input
 * @returns {Promise<{actions: object[], meta: object}>}
 */
async function listActions({ query }) {
  const { page, limit, skip } = getPagination(query);
  const filter = {};
  if (query.action) filter.action = query.action;
  if (query.targetType) filter.targetType = query.targetType;

  const [documents, total] = await Promise.all([
    ModerationAction.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('moderator', 'displayName role'),
    ModerationAction.countDocuments(filter),
  ]);

  return {
    actions: documents.map((document) => document.toPublicJSON()),
    meta: buildMeta({ page, limit, total }),
  };
}

/**
 * Aggregate moderation counters (no content, no reporter identity).
 * @returns {Promise<object>} stats
 */
async function getStats() {
  const dayStart = startOfDay();
  const thirtyDaysAgo = new Date(Date.now() - 30 * DAY_MS);
  const contentToday = { createdAt: { $gte: dayStart }, status: { $in: ['published', 'hidden'] } };

  const [openReports, reportsToday, hiddenThreads, hiddenReplies, crisisEvents30d, threadsToday, repliesToday] =
    await Promise.all([
      Report.countDocuments({ status: { $in: ['open', 'reviewing'] } }),
      Report.countDocuments({ createdAt: { $gte: dayStart } }),
      Thread.countDocuments({ status: 'hidden' }),
      Reply.countDocuments({ status: 'hidden' }),
      CrisisEvent.countDocuments({ createdAt: { $gte: thirtyDaysAgo } }),
      Thread.countDocuments(contentToday),
      Reply.countDocuments(contentToday),
    ]);

  return {
    stats: {
      openReports,
      reportsToday,
      hiddenThreads,
      hiddenReplies,
      crisisEvents30d,
      threadsToday,
      repliesToday,
    },
  };
}

module.exports = {
  ACTION_MATRIX,
  DESTRUCTIVE_ACTIONS,
  getQueue,
  createAction,
  listActions,
  getStats,
};
