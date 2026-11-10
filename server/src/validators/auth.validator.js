'use strict';

/**
 * Request schemas for `/api/v1/auth` (docs/ARCHITECTURE.md §4.3).
 */
const { z, textSchema } = require('./common.validator');

const emailSchema = z
  .string({ required_error: 'Email is required' })
  .trim()
  .toLowerCase()
  .max(254, 'Email must be at most 254 characters')
  .email('Enter a valid email address');

const registerBody = z
  .object({
    email: emailSchema,
    password: textSchema(10, 128, 'Password must be at least 10 characters').max(
      128,
      'Password must be at most 128 characters'
    ),
    displayName: textSchema(2, 40, 'Display name must be 2-40 characters').optional(),
  })
  .strict();

const loginBody = z
  .object({
    email: emailSchema,
    password: z
      .string({ required_error: 'Password is required' })
      .min(1, 'Password is required')
      .max(128, 'Password must be at most 128 characters'),
  })
  .strict();

module.exports = { registerBody, loginBody };
