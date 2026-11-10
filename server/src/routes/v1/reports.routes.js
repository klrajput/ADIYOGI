'use strict';

/**
 * `/api/v1/reports` router (docs/ARCHITECTURE.md §4.3, §4.4).
 */
const express = require('express');
const asyncHandler = require('../../utils/asyncHandler');
const validate = require('../../middleware/validate');
const { requireSession, requireRole } = require('../../middleware/auth');
const { reportLimiter, writeLimiter } = require('../../middleware/rateLimiters');
const controller = require('../../controllers/reports.controller');
const {
  createReportBody,
  listReportsQuery,
  reportIdParams,
  updateReportBody,
} = require('../../validators/reports.validator');

const router = express.Router();

const moderatorOnly = [requireSession, requireRole('moderator', 'admin')];

router.post(
  '/',
  requireSession,
  reportLimiter,
  validate({ body: createReportBody }),
  asyncHandler(controller.create)
);
router.get('/', ...moderatorOnly, validate({ query: listReportsQuery }), asyncHandler(controller.list));
router.patch(
  '/:id',
  ...moderatorOnly,
  writeLimiter,
  validate({ params: reportIdParams, body: updateReportBody }),
  asyncHandler(controller.update)
);

module.exports = router;
