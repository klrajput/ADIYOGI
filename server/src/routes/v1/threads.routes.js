'use strict';

/**
 * `/api/v1/threads` router (docs/ARCHITECTURE.md §4.3, §4.4).
 */
const express = require('express');
const asyncHandler = require('../../utils/asyncHandler');
const validate = require('../../middleware/validate');
const { requireSession } = require('../../middleware/auth');
const { writeLimiter } = require('../../middleware/rateLimiters');
const controller = require('../../controllers/threads.controller');
const {
  threadIdParams,
  listThreadsQuery,
  createThreadBody,
  updateThreadBody,
  listRepliesQuery,
  createReplyBody,
} = require('../../validators/threads.validator');

const router = express.Router();

router.get('/', validate({ query: listThreadsQuery }), asyncHandler(controller.list));
router.post(
  '/',
  requireSession,
  writeLimiter,
  validate({ body: createThreadBody }),
  asyncHandler(controller.create)
);
router.get('/:id', validate({ params: threadIdParams }), asyncHandler(controller.getOne));
router.patch(
  '/:id',
  requireSession,
  writeLimiter,
  validate({ params: threadIdParams, body: updateThreadBody }),
  asyncHandler(controller.update)
);
router.delete(
  '/:id',
  requireSession,
  writeLimiter,
  validate({ params: threadIdParams }),
  asyncHandler(controller.remove)
);
router.get(
  '/:id/replies',
  validate({ params: threadIdParams, query: listRepliesQuery }),
  asyncHandler(controller.listReplies)
);
router.post(
  '/:id/replies',
  requireSession,
  writeLimiter,
  validate({ params: threadIdParams, body: createReplyBody }),
  asyncHandler(controller.createReply)
);

module.exports = router;
