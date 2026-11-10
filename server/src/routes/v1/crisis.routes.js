'use strict';

/**
 * `/api/v1/crisis` routes (docs/ARCHITECTURE.md §4.3, §4.4, §8).
 * Resources are public; assessment and event recording require a session and are
 * rate limited. User text is never stored, logged or echoed by these routes.
 */
const express = require('express');
const { requireSession } = require('../../middleware/auth');
const { crisisAssessLimiter } = require('../../middleware/rateLimiters');
const validate = require('../../middleware/validate');
const controller = require('../../controllers/crisis.controller');
const schemas = require('../../validators/crisis.validator');

const router = express.Router();

router.get('/resources', validate(schemas.resourcesQuery), controller.getResources);

router.post(
  '/assess',
  requireSession,
  crisisAssessLimiter,
  validate(schemas.assess),
  controller.assess
);

router.post(
  '/events',
  requireSession,
  crisisAssessLimiter,
  validate(schemas.recordEvent),
  controller.recordEvent
);

module.exports = router;
