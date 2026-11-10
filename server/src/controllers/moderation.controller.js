'use strict';

/**
 * Moderation controllers (`/api/v1/moderation`, docs/ARCHITECTURE.md §4.3, §4.4).
 */
const { ok, created } = require('../utils/response');
const moderationService = require('../services/moderationService');

/**
 * GET /moderation/queue (moderator+)
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<import('express').Response>}
 */
async function queue(req, res) {
  const { reports, hiddenThreads, hiddenReplies, meta } = await moderationService.getQueue({ query: req.query });
  return ok(res, { reports, hiddenThreads, hiddenReplies }, { message: 'Moderation queue', meta });
}

/**
 * POST /moderation/actions (moderator+)
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<import('express').Response>}
 */
async function createAction(req, res) {
  const { moderationAction, target } = await moderationService.createAction({
    identity: req.identity,
    input: req.body,
  });
  return created(res, { moderationAction: moderationAction.toPublicJSON(), target }, { message: 'Action applied' });
}

/**
 * GET /moderation/actions (moderator+)
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<import('express').Response>}
 */
async function listActions(req, res) {
  const { actions, meta } = await moderationService.listActions({ query: req.query });
  return ok(res, { actions }, { message: 'Moderation audit log', meta });
}

/**
 * GET /moderation/stats (moderator+)
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<import('express').Response>}
 */
async function stats(req, res) {
  const data = await moderationService.getStats();
  return ok(res, { stats: data.stats }, { message: 'Moderation statistics' });
}

module.exports = { queue, createAction, listActions, stats };
