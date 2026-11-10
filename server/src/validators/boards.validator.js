'use strict';

/**
 * Request schemas for `/api/v1/boards` (docs/ARCHITECTURE.md §4.3, §4.4, §5).
 * Board documents require a description, an icon and at least one guideline.
 */
const { z, boardSlugSchema, tagSchema } = require('./common.validator');

const slugParams = z.object({ slug: boardSlugSchema }).strict();

const boardFields = {
  name: z
    .string({ required_error: 'Name is required' })
    .trim()
    .min(2, 'Name must be at least 2 characters')
    .max(80, 'Name must be at most 80 characters'),
  description: z
    .string({ required_error: 'Description is required' })
    .trim()
    .min(10, 'Description must be at least 10 characters')
    .max(500, 'Description must be at most 500 characters'),
  icon: z.string({ required_error: 'Icon is required' }).trim().min(1, 'Icon is required').max(8, 'Icon must be at most 8 characters'),
  supportLevel: z.enum(['general', 'peer', 'crisis']).optional(),
  guidelines: z
    .array(z.string().trim().min(1).max(300, 'Each guideline must be at most 300 characters'))
    .min(1, 'At least one guideline is required')
    .max(8, 'At most 8 guidelines'),
  tags: z.array(z.string().trim().max(30)).max(12, 'At most 12 tags').optional(),
  order: z.coerce.number().int().min(0).max(999).optional(),
  isActive: z.boolean().optional(),
};

const createBoardBody = z
  .object({
    slug: boardSlugSchema,
    ...boardFields,
  })
  .strict();

const updateBoardBody = z
  .object({
    name: boardFields.name.optional(),
    description: boardFields.description.optional(),
    icon: boardFields.icon.optional(),
    supportLevel: boardFields.supportLevel,
    guidelines: boardFields.guidelines.optional(),
    tags: boardFields.tags,
    order: boardFields.order,
    isActive: boardFields.isActive,
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Provide at least one field to update',
  });

module.exports = { slugParams, createBoardBody, updateBoardBody, tagSchema };
