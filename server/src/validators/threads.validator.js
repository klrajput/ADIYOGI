'use strict';

/**
 * Request schemas for `/api/v1/threads` (docs/ARCHITECTURE.md §4.3, §4.4).
 */
const { z, objectIdSchema, paginationQueryShape, boardSlugSchema, tagSchema, textSchema } =
  require('./common.validator');

const threadIdParams = z.object({ id: objectIdSchema }).strict();

const listThreadsQuery = z
  .object({
    board: boardSlugSchema.optional(),
    q: z.string().trim().max(200, 'Search query must be at most 200 characters').optional(),
    tag: tagSchema.optional(),
    sort: z.enum(['recent', 'new', 'replies']).default('recent'),
    ...paginationQueryShape,
  })
  .strict();

const createThreadBody = z
  .object({
    boardSlug: boardSlugSchema,
    title: textSchema(3, 160, 'Title must be 3-160 characters'),
    body: textSchema(20, 5000, 'Post must be 20-5000 characters'),
    tags: z.array(tagSchema).max(6, 'At most 6 tags allowed').optional(),
    contentWarning: z.boolean().optional(),
  })
  .strict();

const updateThreadBody = z
  .object({
    title: textSchema(3, 160, 'Title must be 3-160 characters').optional(),
    body: textSchema(20, 5000, 'Post must be 20-5000 characters').optional(),
    tags: z.array(tagSchema).max(6, 'At most 6 tags allowed').optional(),
    contentWarning: z.boolean().optional(),
    isPinned: z.boolean().optional(),
    isLocked: z.boolean().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Provide at least one field to update',
  });

const listRepliesQuery = z
  .object({
    sort: z.enum(['old', 'new']).default('old'),
    ...paginationQueryShape,
  })
  .strict();

const createReplyBody = z
  .object({
    body: textSchema(2, 3000, 'Reply must be 2-3000 characters'),
    contentWarning: z.boolean().optional(),
  })
  .strict();

module.exports = {
  threadIdParams,
  listThreadsQuery,
  createThreadBody,
  updateThreadBody,
  listRepliesQuery,
  createReplyBody,
};
