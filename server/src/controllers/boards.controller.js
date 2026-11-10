'use strict';

/**
 * Board controllers (`/api/v1/boards`, docs/ARCHITECTURE.md §4.3, §4.4).
 */
const { ok, created, noContent } = require('../utils/response');
const boardService = require('../services/boardService');

/**
 * GET /boards
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<import('express').Response>}
 */
async function list(req, res) {
  const { boards, meta } = await boardService.listBoards({ query: req.query });
  return ok(res, { boards }, { message: 'Boards', meta });
}

/**
 * GET /boards/:slug
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<import('express').Response>}
 */
async function getOne(req, res) {
  const board = await boardService.getBoard({ slug: req.params.slug, identity: req.identity });
  return ok(res, { board: board.toPublicJSON() }, { message: 'Board' });
}

/**
 * POST /boards (admin only)
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<import('express').Response>}
 */
async function create(req, res) {
  const board = await boardService.createBoard(req.body);
  return created(res, { board: board.toPublicJSON() }, { message: 'Board created' });
}

/**
 * PATCH /boards/:slug (admin only)
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<import('express').Response>}
 */
async function update(req, res) {
  const board = await boardService.updateBoard({ slug: req.params.slug, input: req.body });
  return ok(res, { board: board.toPublicJSON() }, { message: 'Board updated' });
}

/**
 * DELETE /boards/:slug (admin only, soft deactivate, 204)
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<import('express').Response>}
 */
async function remove(req, res) {
  await boardService.deactivateBoard({ slug: req.params.slug });
  return noContent(res);
}

module.exports = { list, getOne, create, update, remove };
