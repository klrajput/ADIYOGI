'use strict';

/**
 * Chat controller (docs/ARCHITECTURE.md §4.3, §4.4).
 * Controllers translate HTTP ⇄ service calls only; business rules live in
 * `services/chatService.js` and models serialise through `toPublicJSON()`.
 */
const asyncHandler = require('../utils/asyncHandler');
const { ok, created, noContent } = require('../utils/response');
const { getPagination, buildMeta } = require('../utils/pagination');
const chatService = require('../services/chatService');
const { inferCountryFromRequest } = require('../data/crisisResources');

/**
 * Identity enriched with the region inferred from `Accept-Language` (never IP).
 * @param {import('express').Request} req
 * @returns {object}
 */
function requestIdentity(req) {
  return { ...req.identity, country: inferCountryFromRequest(req) };
}

const listConversations = asyncHandler(async (req, res) => {
  const { page, limit } = getPagination(req.query, { defaultLimit: 20, maxLimit: 50 });
  const result = await chatService.listConversations(req.identity, { page, limit });
  return ok(
    res,
    { conversations: result.conversations },
    {
      message: 'Conversations retrieved',
      meta: buildMeta({ page: result.page, limit: result.limit, total: result.total }),
    }
  );
});

const createConversation = asyncHandler(async (req, res) => {
  const conversation = await chatService.createConversation(req.identity, {
    title: req.body && req.body.title,
  });
  return created(res, { conversation }, { message: 'Conversation created' });
});

const getConversation = asyncHandler(async (req, res) => {
  const result = await chatService.getConversation(req.identity, req.params.id);
  return ok(
    res,
    { conversation: result.conversation, messages: result.messages },
    {
      message: 'Conversation retrieved',
      meta: buildMeta({
        page: 1,
        limit: result.messages.length || 100,
        total: result.total,
      }),
    }
  );
});

const sendMessage = asyncHandler(async (req, res) => {
  const payload = await chatService.sendMessage(
    requestIdentity(req),
    req.params.id,
    req.body.content
  );
  return ok(res, payload, { message: 'Message sent' });
});

const deleteConversation = asyncHandler(async (req, res) => {
  await chatService.deleteConversation(req.identity, req.params.id);
  return noContent(res);
});

module.exports = {
  listConversations,
  createConversation,
  getConversation,
  sendMessage,
  deleteConversation,
};
