'use strict';

/**
 * Reply controllers (`/api/v1/replies`, docs/ARCHITECTURE.md §4.3, §4.4).
 */
const { noContent } = require('../utils/response');
const replyService = require('../services/replyService');

/**
 * DELETE /replies/:id — soft delete (204).
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<import('express').Response>}
 */
async function remove(req, res) {
  await replyService.deleteReply({ id: req.params.id, identity: req.identity });
  return noContent(res);
}

module.exports = { remove };
