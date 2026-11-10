'use strict';

/**
 * Request schemas for `/api/v1/reports` (docs/ARCHITECTURE.md §4.3, §4.5).
 * Report reasons are frozen to exactly six values.
 */
const { z, objectIdSchema, paginationQueryShape } = require('./common.validator');

const REPORT_REASONS = Object.freeze([
  'spam',
  'harassment',
  'self_harm_risk',
  'graphic',
  'medical_misinformation',
  'other',
]);

const REPORT_STATUSES = Object.freeze(['open', 'reviewing', 'resolved', 'dismissed']);

const createReportBody = z
  .object({
    targetType: z.enum(['thread', 'reply']),
    targetId: objectIdSchema,
    reason: z.enum(REPORT_REASONS, {
      errorMap: () => ({ message: `Reason must be one of: ${REPORT_REASONS.join(', ')}` }),
    }),
    details: z.string().trim().max(500, 'Details must be at most 500 characters').optional(),
  })
  .strict();

const listReportsQuery = z
  .object({
    status: z.enum(REPORT_STATUSES).optional(),
    targetType: z.enum(['thread', 'reply']).optional(),
    ...paginationQueryShape,
  })
  .strict();

const reportIdParams = z.object({ id: objectIdSchema }).strict();

const updateReportBody = z
  .object({
    status: z.enum(['reviewing', 'resolved', 'dismissed']),
    resolutionNote: z
      .string()
      .trim()
      .max(500, 'Resolution note must be at most 500 characters')
      .optional(),
  })
  .strict();

module.exports = {
  REPORT_REASONS,
  REPORT_STATUSES,
  createReportBody,
  listReportsQuery,
  reportIdParams,
  updateReportBody,
};
