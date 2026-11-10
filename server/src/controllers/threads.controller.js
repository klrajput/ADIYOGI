'use strict';

/**
 * Thread controllers (`/api/v1/threads`, docs/ARCHITECTURE.md §4.3, §4.4).
 */
const { ok, created, noContent } = require('../utils/response');
const threadService = require('../services/threadService');
const replyService = require('../services/replyService');
const { serializeOptionsOf } = require('../utils/domain/identity');

/**
 * @param {import('express').Request} req
 * @returns {string} country hint for crisis resource localisation (never geolocation)
 */
function countryOf(req) {
  const value = req.get('x-country');
  return typeof value === 'string' && value.trim() ? value.trim().toUpperCase().slice(0, 2) : null;
}

/**
 * GET /threads
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<import('express').Response>}
 */
async function list(req, res) {
  const { threads, meta } = await threadService.listThreads({ query: req.query, identity: req.identity });
  return ok(res, { threads }, { message: 'Threads', meta });
}

/**
 * POST /threads
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<import('express').Response>}
 */
async function create(req, res) {
  const { thread, support } = await threadService.createThread({
    identity: req.identity,
    input: req.body,
    country: countryOf(req),
  });

  const data = { thread: thread.toPublicJSON(serializeOptionsOf(req.identity)) };
  if (support) data.support = support;
  return created(res, data, { message: 'Thread created' });
}

/**
 * GET /threads/:id
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<import('express').Response>}
 */
async function getOne(req, res) {
  const thread = await threadService.getThread({
    id: req.params.id,
    identity: req.identity,
    viewerKey: threadService.viewerKeyFor({ identity: req.identity, ip: req.ip }),
  });
  return ok(res, { thread: thread.toPublicJSON(serializeOptionsOf(req.identity)) }, { message: 'Thread' });
}

/**
 * PATCH /threads/:id
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<import('express').Response>}
 */
async function update(req, res) {
  const thread = await threadService.updateThread({
    id: req.params.id,
    identity: req.identity,
    input: req.body,
  });
  return ok(res, { thread: thread.toPublicJSON(serializeOptionsOf(req.identity)) }, {
    message: 'Thread updated',
  });
}

/**
 * DELETE /threads/:id — soft delete (204).
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<import('express').Response>}
 */
async function remove(req, res) {
  await threadService.deleteThread({ id: req.params.id, identity: req.identity });
  return noContent(res);
}

/**
 * GET /threads/:id/replies
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<import('express').Response>}
 */
async function listReplies(req, res) {
  const { replies, meta } = await replyService.listReplies({
    threadId: req.params.id,
    identity: req.identity,
    query: req.query,
  });
  return ok(res, { replies }, { message: 'Replies', meta });
}

/**
 * POST /threads/:id/replies
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<import('express').Response>}
 */
async function createReply(req, res) {
  const { reply, support } = await replyService.createReply({
    threadId: req.params.id,
    identity: req.identity,
    input: req.body,
    country: countryOf(req),
  });

  const data = { reply: reply.toPublicJSON(serializeOptionsOf(req.identity)) };
  if (support) data.support = support;
  return created(res, data, { message: 'Reply created' });
}

module.exports = { list, create, getOne, update, remove, listReplies, createReply };
