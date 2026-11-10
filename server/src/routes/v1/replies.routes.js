'use strict';

/**
 * `/api/v1/replies` router (docs/ARCHITECTURE.md §4.3).
 */
const express = require('express');
const asyncHandler = require('../../utils/asyncHandler');
const validate = require('../../middleware/validate');
const { requireSession } = require('../../middleware/auth');
const { writeLimiter } = require('../../middleware/rateLimiters');
const controller = require('../../controllers/replies.controller');
const { replyIdParams } = require('../../validators/replies.validator');

const router = express.Router();

router.delete(
  '/:id',
  requireSession,
  writeLimiter,
  validate({ params: replyIdParams }),
  asyncHandler(controller.remove)
);

module.exports = router;
