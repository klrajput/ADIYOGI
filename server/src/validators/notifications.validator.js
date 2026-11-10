'use strict';

/**
 * Request schemas for `/api/v1/notifications` (docs/ARCHITECTURE.md §4.3).
 */
const { z, objectIdSchema, paginationQueryShape, queryBooleanSchema } = require('./common.validator');

const listNotificationsQuery = z
  .object({
    unreadOnly: queryBooleanSchema.optional(),
    ...paginationQueryShape,
  })
  .strict();

const notificationIdParams = z.object({ id: objectIdSchema }).strict();

module.exports = { listNotificationsQuery, notificationIdParams };
