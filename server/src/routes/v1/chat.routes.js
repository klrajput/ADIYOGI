'use strict';

/**
 * `/api/v1/chat` routes (docs/ARCHITECTURE.md §4.3, §4.4).
 * Every chat route requires a server-issued session; ownership is enforced in
 * `chatService` against `req.identity`.
 */
const express = require('express');
const { requireSession } = require('../../middleware/auth');
const { chatLimiter } = require('../../middleware/rateLimiters');
const validate = require('../../middleware/validate');
const controller = require('../../controllers/chat.controller');
const schemas = require('../../validators/chat.validator');

const router = express.Router();

router.use(requireSession);

router.get('/conversations', validate(schemas.listConversations), controller.listConversations);

router.post('/conversations', validate(schemas.createConversation), controller.createConversation);

router.get('/conversations/:id', validate(schemas.conversationId), controller.getConversation);

router.post(
  '/conversations/:id/messages',
  chatLimiter,
  validate(schemas.sendMessage),
  controller.sendMessage
);

router.delete(
  '/conversations/:id',
  validate(schemas.conversationId),
  controller.deleteConversation
);

module.exports = router;
