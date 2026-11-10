'use strict';

/**
 * `/api/v1/auth` router (docs/ARCHITECTURE.md §4.3, §4.4).
 *
 * CSRF is enforced globally in app.js for state-changing requests; the session
 * bootstrap/register/login paths are exempt there only while no session cookie exists.
 */
const express = require('express');
const asyncHandler = require('../../utils/asyncHandler');
const validate = require('../../middleware/validate');
const { requireSession } = require('../../middleware/auth');
const { authLimiter, writeLimiter } = require('../../middleware/rateLimiters');
const controller = require('../../controllers/auth.controller');
const { registerBody, loginBody } = require('../../validators/auth.validator');

const router = express.Router();

router.post('/session', authLimiter, asyncHandler(controller.createSession));
router.get('/me', requireSession, asyncHandler(controller.getMe));
router.get('/csrf', asyncHandler(controller.getCsrf));
router.post('/register', authLimiter, validate({ body: registerBody }), asyncHandler(controller.register));
router.post('/login', authLimiter, validate({ body: loginBody }), asyncHandler(controller.login));
router.post('/logout', asyncHandler(controller.logout));
router.post('/refresh', writeLimiter, asyncHandler(controller.refresh));

module.exports = router;
