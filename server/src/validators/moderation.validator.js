'use strict';

/**
 * Request schemas for `/api/v1/moderation` (docs/ARCHITECTURE.md §4.3, §4.5).
 */
const { z, objectIdSchema, paginationQueryShape } = require('./common.validator');

const MODERATION_ACTIONS = Object.freeze([
  'hide',
  'unhide',
  'delete',
  'pin',
  'unpin',
  'lock',
  'unlock',
]);

/** Actions that remove content from public view require a written reason. */
const DESTRUCTIVE_ACTIONS = Object.freeze(['hide', 'delete']);

const queueQuery = z
  .object({
    ...paginationQueryShape,
  })
  .strict();

const createActionBody = z
  .object({
    action: z.enum(MODERATION_ACTIONS),
    targetType: z.enum(['thread', 'reply']),
    targetId: objectIdSchema,
    reportId: objectIdSchema.optional(),
    reason: z.string().trim().max(500, 'Reason must be at most 500 characters').optional(),
  })
  .strict()
  .refine(
    (value) => !DESTRUCTIVE_ACTIONS.includes(value.action) || (value.reason && value.reason.length >= 3),
    {
      message: 'A reason (at least 3 characters) is required for hide and delete actions',
      path: ['reason'],
    }
  );

const listActionsQuery = z
  .object({
    action: z.enum([...MODERATION_ACTIONS, 'report_review', 'report_resolve', 'report_dismiss']).optional(),
    targetType: z.enum(['thread', 'reply', 'report']).optional(),
    ...paginationQueryShape,
  })
  .strict();

module.exports = {
  MODERATION_ACTIONS,
  DESTRUCTIVE_ACTIONS,
  queueQuery,
  createActionBody,
  listActionsQuery,
};
