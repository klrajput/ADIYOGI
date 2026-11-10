'use strict';

/**
 * Thread business rules for `/api/v1/threads` (docs/ARCHITECTURE.md §4.3, §4.4, §5, §12.7).
 *
 * Public listings only ever expose `published` threads (moderators additionally see
 * `hidden` ones); the author's own hidden/deleted content is available through
 * `/users/me/content`. Search uses the MongoDB text index and falls back to an escaped
 * regex when the text index is unavailable, so the endpoint never 500s on a fresh DB.
 */
const Thread = require('../models/Thread');
const Board = require('../models/Board');
const ModerationAction = require('../models/ModerationAction');
const logger = require('../config/logger');
const ApiError = require('../utils/ApiError');
const { getPagination, buildMeta } = require('../utils/pagination');
const { hashIp } = require('../utils/redact');
const { stripHtml, normalizeText, containsBlockedTerms } = require('../middleware/sanitize');
const counterService = require('./counterService');
const crisisSignalService = require('./crisisSignalService');
const { viewerIdOf, isModerator, serializeOptionsOf, authorFieldsOf } = require('../utils/domain/identity');

const EDIT_WINDOW_MS = 15 * 60 * 1000;
const VIEW_THROTTLE_MS = 10 * 60 * 1000;
const VIEW_CACHE_LIMIT = 5000;
const EXCERPT_LENGTH = 180;

const LIST_SORTS = Object.freeze({
  recent: { isPinned: -1, lastActivityAt: -1, createdAt: -1 },
  new: { isPinned: -1, createdAt: -1 },
  replies: { isPinned: -1, replyCount: -1, lastActivityAt: -1 },
});

/** @type {Map<string, number>} thread id + viewer key -> cache expiry */
const viewCache = new Map();

/**
 * Populate only what the frozen Thread shape needs for `boardName` (§12.7). A single
 * extra query per listing — never a per-row N+1.
 */
const BOARD_POPULATE = Object.freeze({ path: 'board', select: 'name slug' });

/**
 * True when a Mongo error means "no text index on this collection".
 * @param {*} error
 * @returns {boolean}
 */
function isTextSearchUnavailable(error) {
  if (!error) return false;
  if (error.code === 27 || error.codeName === 'IndexNotFound') return true;
  return /text index|indexnotfound|\$text|no such index/i.test(String(error.message || ''));
}

/**
 * Escape a user-supplied string for use inside a RegExp (search fallback).
 * @param {string} value
 * @returns {string}
 */
function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Strip HTML and clipboard-hostile whitespace from a title.
 * @param {string} value
 * @returns {string}
 */
function cleanTitle(value) {
  return normalizeText(stripHtml(value)).slice(0, 160);
}

/**
 * Strip HTML from user prose while preserving paragraph breaks.
 * @param {string} value
 * @returns {string}
 */
function cleanBody(value) {
  return stripHtml(value)
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .trim()
    .slice(0, 5000);
}

/**
 * Derive a one-line excerpt from the body.
 * @param {string} body
 * @returns {string}
 */
function deriveExcerpt(body) {
  const flat = String(body || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (flat.length <= EXCERPT_LENGTH) return flat;
  return `${flat.slice(0, EXCERPT_LENGTH).trimEnd()}…`;
}

/**
 * Reject content that violates the platform denylist.
 * @param {string} text
 * @returns {void}
 */
function assertContentAllowed(text) {
  if (containsBlockedTerms(text)) {
    throw ApiError.unprocessable('CONTENT_BLOCKED', 'This content violates our community guidelines');
  }
}

/**
 * Whether the caller may view a thread that is not public.
 * @param {object} thread
 * @param {object|null} identity
 * @returns {boolean}
 */
function canView(thread, identity) {
  if (!thread) return false;
  if (thread.status === 'published') return true;
  if (thread.status !== 'hidden') return false;
  if (!identity) return false;
  return isModerator(identity) || String(thread.authorId) === viewerIdOf(identity);
}

/**
 * Load a thread the caller is allowed to see, or throw NOT_FOUND.
 * @param {string} id
 * @param {object|null} identity
 * @returns {Promise<object>} Thread document
 */
async function loadVisibleThread(id, identity) {
  const thread = await Thread.findById(id);
  if (!thread || !canView(thread, identity)) throw ApiError.notFound('Thread not found');
  return thread;
}

/**
 * Count a view at most once per viewer+thread per 10 minutes (in-memory throttle).
 * @param {string} key
 * @returns {boolean}
 */
function consumeViewSlot(key) {
  const now = Date.now();
  const expiresAt = viewCache.get(key);
  if (expiresAt && expiresAt > now) return false;

  if (viewCache.size >= VIEW_CACHE_LIMIT) {
    for (const [cachedKey, cachedExpiry] of viewCache) {
      if (cachedExpiry <= now) viewCache.delete(cachedKey);
    }
    if (viewCache.size >= VIEW_CACHE_LIMIT) viewCache.clear();
  }

  viewCache.set(key, now + VIEW_THROTTLE_MS);
  return true;
}

/**
 * Paginated public thread listing with board/tag filters, search and sorting.
 * @param {{query: object, identity: object|null}} input
 * @returns {Promise<{threads: object[], meta: object}>}
 */
async function listThreads({ query, identity }) {
  const { page, limit, skip } = getPagination(query);
  const options = serializeOptionsOf(identity);
  const statuses = ['published'];
  if (isModerator(identity)) statuses.push('hidden');

  const filter = { status: { $in: statuses } };
  if (query.board) filter.boardSlug = query.board;
  if (query.tag) filter.tags = query.tag;
  const sort = LIST_SORTS[query.sort] || LIST_SORTS.recent;
  const search = typeof query.q === 'string' ? query.q.trim() : '';

  if (search) {
    try {
      const textFilter = { ...filter, $text: { $search: search } };
      const [documents, total] = await Promise.all([
        Thread.find(textFilter, { score: { $meta: 'textScore' } })
          .sort({ score: { $meta: 'textScore' }, ...sort })
          .skip(skip)
          .limit(limit)
          .populate(BOARD_POPULATE),
        Thread.countDocuments(textFilter),
      ]);
      return {
        threads: documents.map((document) => document.toPublicJSON(options)),
        meta: buildMeta({ page, limit, total }),
      };
    } catch (error) {
      if (!isTextSearchUnavailable(error)) throw error;
      logger.warn('threads.text_search_fallback', { reason: 'text_index_unavailable' });
    }
  }

  const regexFilter = { ...filter };
  if (search) {
    const pattern = new RegExp(escapeRegex(search), 'i');
    regexFilter.$or = [{ title: pattern }, { body: pattern }];
  }

  const [documents, total] = await Promise.all([
    Thread.find(regexFilter).sort(sort).skip(skip).limit(limit).populate(BOARD_POPULATE),
    Thread.countDocuments(regexFilter),
  ]);

  return {
    threads: documents.map((document) => document.toPublicJSON(options)),
    meta: buildMeta({ page, limit, total }),
  };
}

/**
 * Fetch a single visible thread and count a throttled view.
 * @param {{id: string, identity: object|null, viewerKey: string}} input
 * @returns {Promise<object>} Thread document
 */
async function getThread({ id, identity, viewerKey }) {
  const thread = await loadVisibleThread(id, identity);
  await thread.populate(BOARD_POPULATE);

  if (consumeViewSlot(`${viewerKey}:${id}`)) {
    Thread.updateOne({ _id: thread._id }, { $inc: { viewCount: 1 } }).catch((error) => {
      logger.warn('threads.view_count_failed', { code: error && error.code });
    });
  }

  return thread;
}

/**
 * Create a thread, update counters and run the advisory crisis assessment.
 * @param {{identity: object, input: object, country?: string|null}} input
 * @returns {Promise<{thread: object, support: object|null}>}
 */
async function createThread({ identity, input, country }) {
  const board = await Board.findOne({ slug: input.boardSlug, isActive: true });
  if (!board) throw ApiError.notFound('Board not found or inactive');

  const title = cleanTitle(input.title);
  const body = cleanBody(input.body);
  assertContentAllowed(`${title}\n${body}`);

  const thread = await Thread.create({
    board: board._id,
    boardSlug: board.slug,
    title,
    body,
    excerpt: deriveExcerpt(body),
    contentWarning: Boolean(input.contentWarning),
    tags: input.tags || [],
    ...authorFieldsOf(identity),
    status: 'published',
    isPinned: false,
    isLocked: false,
    lastActivityAt: new Date(),
  });

  await counterService.onThreadCreated(board._id);
  await thread.populate(BOARD_POPULATE);

  const assessment = await crisisSignalService.assessContent(`${title}\n\n${body}`);
  await crisisSignalService.recordIfElevated({ sessionId: String(identity.sessionId), assessment, country });

  return { thread, support: crisisSignalService.supportFor(assessment) };
}

/**
 * Update a thread: the author may edit content within 15 minutes; moderators may
 * pin/lock and those changes are audited as ModerationAction documents.
 * @param {{id: string, identity: object, input: object}} input
 * @returns {Promise<object>} updated Thread document
 */
async function updateThread({ id, identity, input }) {
  const thread = await loadVisibleThread(id, identity);
  if (thread.status === 'deleted') throw ApiError.notFound('Thread not found');

  const actorId = viewerIdOf(identity);
  const owner = String(thread.authorId) === actorId;
  const moderator = isModerator(identity);
  const contentFields = ['title', 'body', 'tags', 'contentWarning'].filter((field) => input[field] !== undefined);
  const moderatorFields = ['isPinned', 'isLocked'].filter((field) => input[field] !== undefined);

  if (contentFields.length > 0) {
    if (!owner) throw ApiError.forbidden('Only the author can edit this post');
    const createdAt = new Date(thread.createdAt).getTime();
    if (Date.now() - createdAt > EDIT_WINDOW_MS) {
      throw ApiError.forbidden('The 15-minute edit window has passed');
    }
    if (thread.status !== 'published') throw ApiError.forbidden('Only published posts can be edited');
  }

  if (moderatorFields.length > 0 && !moderator) {
    throw ApiError.forbidden('Only moderators can pin or lock threads');
  }

  const changedModeration = [];
  if (contentFields.includes('title')) {
    const title = cleanTitle(input.title);
    assertContentAllowed(title);
    thread.title = title;
  }
  if (contentFields.includes('body')) {
    const body = cleanBody(input.body);
    assertContentAllowed(body);
    thread.body = body;
    thread.excerpt = deriveExcerpt(body);
  }
  if (contentFields.includes('tags')) thread.tags = input.tags;
  if (contentFields.includes('contentWarning')) thread.contentWarning = input.contentWarning;

  if (moderatorFields.includes('isPinned') && thread.isPinned !== input.isPinned) {
    thread.isPinned = input.isPinned;
    changedModeration.push(input.isPinned ? 'pin' : 'unpin');
  }
  if (moderatorFields.includes('isLocked') && thread.isLocked !== input.isLocked) {
    thread.isLocked = input.isLocked;
    changedModeration.push(input.isLocked ? 'lock' : 'unlock');
  }

  if (contentFields.length > 0) thread.editedAt = new Date();
  if (moderatorFields.length > 0) thread.moderatedBy = identity.userId || null;

  await thread.save();

  if (changedModeration.length > 0) {
    await ModerationAction.insertMany(
      changedModeration.map((action) => ({
        moderator: identity.userId,
        action,
        targetType: 'thread',
        targetId: thread._id,
        reason: `Thread ${action === 'pin' || action === 'unpin' ? 'pin state' : 'lock state'} changed via thread update`,
      }))
    );
  }

  await thread.populate(BOARD_POPULATE);
  return thread;
}

/**
 * Soft-delete a thread (author or moderator) and keep board counters consistent.
 * @param {{id: string, identity: object}} input
 * @returns {Promise<void>}
 */
async function deleteThread({ id, identity }) {
  const thread = await loadVisibleThread(id, identity);
  if (thread.status === 'deleted') throw ApiError.notFound('Thread not found');

  const owner = String(thread.authorId) === viewerIdOf(identity);
  const moderator = isModerator(identity);
  if (!owner && !moderator) throw ApiError.forbidden('You are not allowed to delete this thread');

  thread.status = 'deleted';
  thread.deletedAt = new Date();
  if (moderator) {
    thread.moderatedBy = identity.userId || null;
    thread.moderationReason = 'Thread removed by moderator';
  }
  await thread.save();
  await counterService.onThreadRemoved(thread.board, thread.replyCount);

  if (moderator) {
    await ModerationAction.create({
      moderator: identity.userId,
      action: 'delete',
      targetType: 'thread',
      targetId: thread._id,
      reason: 'Thread deleted by moderator',
    });
  }
}

/**
 * Viewer cache key for throttled view counting.
 * @param {{identity: object|null, ip: string|undefined}} input
 * @returns {string}
 */
function viewerKeyFor({ identity, ip }) {
  return identity ? `session:${viewerIdOf(identity)}` : `ip:${hashIp(ip)}`;
}

module.exports = {
  EDIT_WINDOW_MS,
  LIST_SORTS,
  canView,
  loadVisibleThread,
  listThreads,
  getThread,
  createThread,
  updateThread,
  deleteThread,
  viewerKeyFor,
  deriveExcerpt,
  escapeRegex,
  isTextSearchUnavailable,
};
