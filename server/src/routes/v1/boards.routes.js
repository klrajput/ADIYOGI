'use strict';

/**
 * `/api/v1/boards` router (docs/ARCHITECTURE.md §4.3, §4.4).
 */
const express = require('express');
const asyncHandler = require('../../utils/asyncHandler');
const validate = require('../../middleware/validate');
const { requireSession, requireRole } = require('../../middleware/auth');
const { writeLimiter } = require('../../middleware/rateLimiters');
const controller = require('../../controllers/boards.controller');
const { slugParams, createBoardBody, updateBoardBody } = require('../../validators/boards.validator');

const router = express.Router();

const adminOnly = [requireSession, requireRole('admin')];

router.get('/', asyncHandler(controller.list));
router.get('/:slug', validate({ params: slugParams }), asyncHandler(controller.getOne));
router.post('/', ...adminOnly, writeLimiter, validate({ body: createBoardBody }), asyncHandler(controller.create));
router.patch(
  '/:slug',
  ...adminOnly,
  writeLimiter,
  validate({ params: slugParams, body: updateBoardBody }),
  asyncHandler(controller.update)
);
router.delete(
  '/:slug',
  ...adminOnly,
  writeLimiter,
  validate({ params: slugParams }),
  asyncHandler(controller.remove)
);

module.exports = router;
