'use strict';

/**
 * Report business rules for `/api/v1/reports` (docs/ARCHITECTURE.md §4.3, §4.5).
 *
 * Reports are written by any session (`reportedBy` = the server-side ownership id: the
 * Session id for anonymous callers, the User id for accounts — same rule as every other
 * ownership check, so duplicate reports and self-reporting are blocked consistently) and
 * read/resolved by moderators. Reporter identity is never exposed in moderator
 * payloads; the enriched target preview is truncated so the queue cannot be used as a
 * content exfiltration channel.
 */
const Report = require('../models/Report');
const Thread = require('../models/Thread');
const Reply = require('../models/Reply');
const ModerationAction = require('../models/ModerationAction');
const ApiError = require('../utils/ApiError');
const { getPagination, buildMeta } = require('../utils/pagination');
const { viewerIdOf } = require('../utils/domain/identity');

const EXCERPT_LENGTH = 200;

/** Report status -> ModerationAction audit value (frozen enum, §4.5). */
const REPORT_ACTION_BY_STATUS = Object.freeze({
  reviewing: 'report_review',
  resolved: 'report_resolve',
  dismissed: 'report_dismiss',
});

/**
 * @param {string} value
 * @returns {string}
 */
function excerpt(value) {
  const flat = String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
  return flat.length > EXCERPT_LENGTH ? `${flat.slice(0, EXCERPT_LENGTH).trimEnd()}…` : flat;
}

/**
 * Enrich reports with a bounded target preview without N+1 queries.
 * @param {object[]} reports Report documents
 * @param {string} [viewerId] ownership id of the caller (for `isOwner`)
 * @returns {Promise<object[]>}
 */
async function enrichReports(reports, viewerId) {
  if (reports.length === 0) return [];

  const threadIds = reports.filter((report) => report.targetType === 'thread').map((report) => report.targetId);
  const replyIds = reports.filter((report) => report.targetType === 'reply').map((report) => report.targetId);

  const [threads, replies] = await Promise.all([
    threadIds.length > 0
      ? Thread.find({ _id: { $in: threadIds } }).select('_id title boardSlug body status authorAlias')
      : [],
    replyIds.length > 0
      ? Reply.find({ _id: { $in: replyIds } }).select('_id thread body status authorAlias')
      : [],
  ]);

  const replyThreadIds = replies.map((reply) => reply.thread).filter(Boolean);
  const parentThreads =
    replyThreadIds.length > 0
      ? await Thread.find({ _id: { $in: replyThreadIds } }).select('_id title boardSlug status')
      : [];

  const threadMap = new Map(threads.map((thread) => [String(thread._id), thread]));
  const replyMap = new Map(replies.map((reply) => [String(reply._id), reply]));
  const parentThreadMap = new Map(parentThreads.map((thread) => [String(thread._id), thread]));

  return reports.map((report) => {
    const publicReport = report.toPublicJSON({ viewerId });
    const target =
      report.targetType === 'thread' ? threadMap.get(String(report.targetId)) : replyMap.get(String(report.targetId));
    const thread =
      report.targetType === 'thread'
        ? target
        : parentThreadMap.get(String(report.targetThread || (target && target.thread)));

    return {
      ...publicReport,
      targetExcerpt: target ? excerpt(target.body) : null,
      targetStatus: target ? target.status : null,
      targetAuthorAlias: target ? target.authorAlias : null,
      targetThread: thread
        ? { id: String(thread._id), title: thread.title, boardSlug: thread.boardSlug, status: thread.status }
        : null,
    };
  });
}

/**
 * File a report against a published thread/reply.
 * @param {{identity: object, input: object}} params
 * @returns {Promise<object>} Report document
 */
async function createReport({ identity, input }) {
  const reporterId = viewerIdOf(identity);
  const reporterSessionId = String(identity.sessionId);

  // Application-level guard as well as the unique index: on a brand-new database the index
  // build is asynchronous, so this keeps duplicate-report semantics deterministic.
  const existing = await Report.findOne({
    targetType: input.targetType,
    targetId: input.targetId,
    reportedBy: reporterId,
  })
    .select('_id')
    .lean();
  if (existing) throw ApiError.conflict('You have already reported this content');

  let targetThread = null;
  let authorId = null;

  if (input.targetType === 'thread') {
    const thread = await Thread.findById(input.targetId).select('_id authorId status');
    if (!thread) throw ApiError.notFound('Thread not found');
    if (thread.status !== 'published') throw ApiError.badRequest('VALIDATION_ERROR', 'This content is not reportable');
    authorId = String(thread.authorId);
    targetThread = thread._id;
  } else {
    const reply = await Reply.findById(input.targetId).select('_id authorId thread status');
    if (!reply) throw ApiError.notFound('Reply not found');
    if (reply.status !== 'published') {
      throw ApiError.badRequest('VALIDATION_ERROR', 'This content is not reportable');
    }
    authorId = String(reply.authorId);
    targetThread = reply.thread;
  }

  // The author id is the User id for accounts and the Session id for anonymous content;
  // compare against both so a signed-in author can never report their own post.
  if (authorId === reporterId || authorId === reporterSessionId) {
    throw ApiError.badRequest('VALIDATION_ERROR', 'You cannot report your own content');
  }

  try {
    return await Report.create({
      targetType: input.targetType,
      targetId: input.targetId,
      targetThread,
      reportedBy: reporterId,
      reason: input.reason,
      details: input.details,
      status: 'open',
    });
  } catch (error) {
    if (error && error.code === 11000) {
      throw ApiError.conflict('You have already reported this content');
    }
    throw error;
  }
}

/**
 * Paginated report list for moderators, enriched with target previews.
 * @param {{query: object}} input
 * @returns {Promise<{reports: object[], meta: object}>}
 */
async function listReports({ query, identity }) {
  const viewerId = viewerIdOf(identity);
  const { page, limit, skip } = getPagination(query);
  const filter = {};
  if (query.status) filter.status = query.status;
  if (query.targetType) filter.targetType = query.targetType;

  const [documents, total] = await Promise.all([
    Report.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Report.countDocuments(filter),
  ]);

  return { reports: await enrichReports(documents, viewerId), meta: buildMeta({ page, limit, total }) };
}

/**
 * Change a report's status and audit the transition as a ModerationAction.
 * @param {{identity: object, id: string, input: object}} params
 * @returns {Promise<object>} updated Report document
 */
async function updateReport({ identity, id, input }) {
  const report = await Report.findById(id);
  if (!report) throw ApiError.notFound('Report not found');

  const previousStatus = report.status;
  report.status = input.status;
  if (input.resolutionNote !== undefined) report.resolutionNote = input.resolutionNote;
  if (identity.userId) report.reviewedBy = identity.userId;
  report.reviewedAt = new Date();
  await report.save();

  const action = REPORT_ACTION_BY_STATUS[input.status] || 'report_review';
  await ModerationAction.create({
    moderator: identity.userId,
    action,
    targetType: 'report',
    targetId: report._id,
    reportId: report._id,
    reason: input.resolutionNote || `Report ${previousStatus} → ${input.status}`,
  });

  return report;
}

module.exports = {
  REPORT_ACTION_BY_STATUS,
  enrichReports,
  createReport,
  listReports,
  updateReport,
};
