'use strict';

/**
 * `/api/v1/moderation` router (docs/ARCHITECTURE.md §4.3, §4.4).
 * Every endpoint requires a signed-in moderator or admin account.
 */
const express = require('express');
const asyncHandler = require('../../utils/asyncHandler');
const validate = require('../../middleware/validate');
const { requireSession, requireRole } = require('../../middleware/auth');
const { writeLimiter } = require('../../middleware/rateLimiters');
const controller = require('../../controllers/moderation.controller');
const { queueQuery, createActionBody, listActionsQuery } = require('../../validators/moderation.validator');

const router = express.Router();

const moderatorOnly = [requireSession, requireRole('moderator', 'admin')];

router.get('/queue', ...moderatorOnly, validate({ query: queueQuery }), asyncHandler(controller.queue));
router.post(
  '/actions',
  ...moderatorOnly,
  writeLimiter,
  validate({ body: createActionBody }),
  asyncHandler(controller.createAction)
);
router.get('/actions', ...moderatorOnly, validate({ query: listActionsQuery }), asyncHandler(controller.listActions));
router.get('/stats', ...moderatorOnly, asyncHandler(controller.stats));

module.exports = router;
