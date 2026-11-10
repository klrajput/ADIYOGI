'use strict';

/**
 * Request schemas for `/api/v1/replies` (docs/ARCHITECTURE.md §4.3).
 */
const { z, objectIdSchema } = require('./common.validator');

const replyIdParams = z.object({ id: objectIdSchema }).strict();

module.exports = { replyIdParams };
