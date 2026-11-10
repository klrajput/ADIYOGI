'use strict';

/**
 * `/api/v1/notifications` router (docs/ARCHITECTURE.md §4.3, §4.4).
 */
const express = require('express');
const asyncHandler = require('../../utils/asyncHandler');
const validate = require('../../middleware/validate');
const { requireSession } = require('../../middleware/auth');
const { writeLimiter } = require('../../middleware/rateLimiters');
const controller = require('../../controllers/notifications.controller');
const {
  listNotificationsQuery,
  notificationIdParams,
} = require('../../validators/notifications.validator');

const router = express.Router();

router.get('/', requireSession, validate({ query: listNotificationsQuery }), asyncHandler(controller.list));
router.patch(
  '/:id/read',
  requireSession,
  writeLimiter,
  validate({ params: notificationIdParams }),
  asyncHandler(controller.markRead)
);
router.post('/read-all', requireSession, writeLimiter, asyncHandler(controller.markAllRead));

module.exports = router;
