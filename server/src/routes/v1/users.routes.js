'use strict';

/**
 * `/api/v1/users` router (docs/ARCHITECTURE.md §4.3, §4.4).
 */
const express = require('express');
const asyncHandler = require('../../utils/asyncHandler');
const validate = require('../../middleware/validate');
const { requireSession } = require('../../middleware/auth');
const { writeLimiter } = require('../../middleware/rateLimiters');
const controller = require('../../controllers/users.controller');
const { updatePreferencesBody, listContentQuery, deleteAccountBody } = require('../../validators/users.validator');

const router = express.Router();

router.get('/me/preferences', requireSession, asyncHandler(controller.getPreferences));
router.patch(
  '/me/preferences',
  requireSession,
  writeLimiter,
  validate({ body: updatePreferencesBody }),
  asyncHandler(controller.updatePreferences)
);
router.get(
  '/me/content',
  requireSession,
  validate({ query: listContentQuery }),
  asyncHandler(controller.listContent)
);
router.delete(
  '/me',
  requireSession,
  writeLimiter,
  validate({ body: deleteAccountBody }),
  asyncHandler(controller.deleteMe)
);

module.exports = router;
