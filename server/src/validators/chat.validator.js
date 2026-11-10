'use strict';

/**
 * Zod schemas for the chat routes (docs/ARCHITECTURE.md §4, §12.1).
 * Shapes are `{ params?, query?, body? }` for `middleware/validate.js`.
 */
const { z } = require('zod');

const objectId = z.string().trim().regex(/^[a-f\d]{24}$/i, 'Invalid id');

const conversationId = {
  params: z.object({ id: objectId }),
};

const listConversations = {
  query: z.object({
    page: z.coerce.number().int().min(1).max(10000).optional(),
    limit: z.coerce.number().int().min(1).max(50).optional(),
  }),
};

const createConversation = {
  body: z.object({
    title: z.string().trim().min(1).max(120).optional(),
  }),
};

const sendMessage = {
  params: z.object({ id: objectId }),
  body: z.object({
    content: z
      .string()
      .trim()
      .min(1, 'Message cannot be empty')
      .max(2000, 'Message must be at most 2000 characters'),
  }),
};

module.exports = {
  conversationId,
  listConversations,
  createConversation,
  sendMessage,
};
