'use strict';

/**
 * Shared zod primitives for request validation (docs/ARCHITECTURE.md §12.1).
 *
 * Every route validates `params`, `query` and `body` with the zod schemas built here;
 * `middleware/validate.js` replaces `req.params/query/body` with the parsed values and
 * throws a `VALIDATION_ERROR` ApiError on failure (never a raw zod error).
 */
const { z } = require('zod');

/** MongoDB ObjectId in its 24-hex-character string form. */
const objectIdSchema = z
  .string()
  .trim()
  .regex(/^[a-f0-9]{24}$/i, 'Must be a valid 24-character id');

/**
 * Pagination query params. Limits are bounded here and clamped again by
 * utils/pagination (`limit <= 50` per contract).
 */
const paginationQueryShape = {
  page: z.coerce.number().int().min(1).max(1_000_000).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
};

/** Board slugs are lowercase kebab-case. */
const boardSlugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(2, 'Slug must be at least 2 characters')
  .max(40, 'Slug must be at most 40 characters')
  .regex(/^[a-z0-9-]+$/, 'Slug may only contain lowercase letters, numbers and hyphens');

/** Thread/reply tags: lowercase kebab-case, 2-24 chars. */
const tagSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9-]{2,24}$/, 'Tags must be 2-24 characters: lowercase letters, numbers, hyphens');

/**
 * Coerce a query-string boolean ("true"/"false") to a real boolean without the
 * classic `Boolean("false") === true` trap.
 */
const queryBooleanSchema = z
  .union([z.boolean(), z.enum(['true', 'false', '1', '0'])])
  .transform((value) => {
    if (typeof value === 'boolean') return value;
    return value === 'true' || value === '1';
  });

/**
 * Trim + normalise a plain-text field and enforce a length window after trimming.
 * @param {number} min
 * @param {number} max
 * @param {string} [message]
 * @returns {import('zod').ZodString}
 */
function textSchema(min, max, message) {
  return z
    .string({ required_error: 'Required', invalid_type_error: 'Must be text' })
    .trim()
    .min(min, message || `Must be at least ${min} characters`)
    .max(max, `Must be at most ${max} characters`);
}

module.exports = {
  z,
  objectIdSchema,
  paginationQueryShape,
  boardSlugSchema,
  tagSchema,
  queryBooleanSchema,
  textSchema,
};
