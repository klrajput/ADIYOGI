'use strict';

/**
 * Zod schemas for the crisis routes (docs/ARCHITECTURE.md §4, §8, §12.1).
 * Shapes are `{ params?, query?, body? }` for `middleware/validate.js`.
 */
const { z } = require('zod');

const SOURCES = ['manual', 'chat', 'content', 'assessment'];

const resourcesQuery = {
  query: z.object({
    country: z.string().trim().max(40).optional(),
  }),
};

const assess = {
  body: z.object({
    text: z.string().trim().min(1, 'Text is required').max(5000, 'Text is too long'),
    source: z.enum(SOURCES).optional(),
  }),
};

const recordEvent = {
  body: z.object({
    level: z.enum(['low', 'elevated', 'high']),
    source: z.enum(SOURCES),
    country: z.string().trim().max(40).optional(),
  }),
};

module.exports = {
  SOURCES,
  resourcesQuery,
  assess,
  recordEvent,
};
