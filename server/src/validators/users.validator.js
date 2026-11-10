'use strict';

/**
 * Request schemas for `/api/v1/users` (docs/ARCHITECTURE.md §4.3, §4.4).
 */
const { z, paginationQueryShape, textSchema } = require('./common.validator');

const displayAliasSchema = textSchema(3, 24, 'Display alias must be 3-24 characters').regex(
  /^[\w .-]+$/,
  'Display alias may only contain letters, numbers, spaces, dots, underscores and hyphens'
);

const updatePreferencesBody = z
  .object({
    displayAlias: displayAliasSchema.optional(),
    showCrisisBar: z.boolean().optional(),
    contentWarningDefault: z.boolean().optional(),
    reduceMotion: z.boolean().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Provide at least one preference to update',
  });

const listContentQuery = z
  .object({
    type: z.enum(['threads', 'replies']).default('threads'),
    ...paginationQueryShape,
  })
  .strict();

const deleteAccountBody = z
  .object({
    deleteContent: z.boolean().optional(),
  })
  .strict()
  .default({});

module.exports = { updatePreferencesBody, listContentQuery, deleteAccountBody };
