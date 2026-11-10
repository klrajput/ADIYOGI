'use strict';

/**
 * Board/thread counter maintenance.
 *
 * Counters are stored denormalised for cheap list rendering
 * (`Board.threadCount`, `Board.replyCount`, `Thread.replyCount`). They are only
 * mutated here so every create/delete/moderation path keeps them consistent and
 * they can never go negative.
 */
const Board = require('../models/Board');
const Thread = require('../models/Thread');
const logger = require('../config/logger');

/**
 * Clamp a numeric field to `>= 0` while adding a delta, in one atomic update.
 * @param {object} model Mongoose model
 * @param {object} filter
 * @param {Record<string, number>} deltas map of field -> delta (can be negative)
 * @param {object} [extraSet] additional `$set` fields
 * @returns {Promise<*>}
 */
async function applyDeltas(model, filter, deltas, extraSet = {}) {
  const set = { ...extraSet };
  for (const [field, delta] of Object.entries(deltas)) {
    set[field] = { $max: [0, { $add: [{ $ifNull: [`$${field}`, 0] }, delta] }] };
  }
  return model.updateOne(filter, [{ $set: set }]).exec();
}

/**
 * A thread was created in a board.
 * @param {string} boardId
 * @param {Date} [at]
 * @returns {Promise<void>}
 */
async function onThreadCreated(boardId, at = new Date()) {
  await applyDeltas(Board, { _id: boardId }, { threadCount: 1 }, { lastActivityAt: at });
}

/**
 * A thread was hard/soft deleted from a board; its replies disappear with it.
 * @param {string} boardId
 * @param {number} replyCount number of replies that were attached to the thread
 * @returns {Promise<void>}
 */
async function onThreadRemoved(boardId, replyCount = 0) {
  await applyDeltas(
    Board,
    { _id: boardId },
    { threadCount: -1, replyCount: -Math.max(0, Number(replyCount) || 0) }
  );
}

/**
 * A reply was added to a thread.
 * @param {string} threadId
 * @param {string} boardSlug
 * @param {Date} [at]
 * @returns {Promise<void>}
 */
async function onReplyCreated(threadId, boardSlug, at = new Date()) {
  await Promise.all([
    applyDeltas(Thread, { _id: threadId }, { replyCount: 1 }, { lastActivityAt: at }),
    applyDeltas(Board, { slug: boardSlug }, { replyCount: 1 }, { lastActivityAt: at }),
  ]);
}

/**
 * A reply was removed from a thread.
 * @param {string} threadId
 * @param {string} boardSlug
 * @returns {Promise<void>}
 */
async function onReplyRemoved(threadId, boardSlug) {
  await Promise.all([
    applyDeltas(Thread, { _id: threadId }, { replyCount: -1 }),
    applyDeltas(Board, { slug: boardSlug }, { replyCount: -1 }),
  ]);
}

/**
 * Re-apply deltas for a batch of board counter changes (used by account deletion).
 * @param {Record<string, {threadCount:number, replyCount:number}>} perSlug
 * @returns {Promise<void>}
 */
async function applyBoardDeltas(perSlug) {
  const entries = Object.entries(perSlug || {});
  if (entries.length === 0) return;
  await Promise.all(
    entries.map(([slug, delta]) =>
      applyDeltas(Board, { slug }, { threadCount: delta.threadCount, replyCount: delta.replyCount })
    )
  );
}

/**
 * Fire-and-forget wrapper for counter updates that must never fail the request
 * that triggered them (e.g. the last reply of a deleted thread).
 * @param {Promise<*>} promise
 * @param {string} operation log label
 * @returns {void}
 */
function bestEffort(promise, operation) {
  Promise.resolve(promise).catch((error) => {
    logger.warn('counter.update_failed', { operation, code: error && error.code });
  });
}

module.exports = {
  onThreadCreated,
  onThreadRemoved,
  onReplyCreated,
  onReplyRemoved,
  applyBoardDeltas,
  bestEffort,
};
