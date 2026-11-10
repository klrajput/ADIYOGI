'use strict';

/**
 * `/api/v1` router. Mounts every feature router; feature routers must only
 * declare paths relative to their mount point (see docs/ARCHITECTURE.md §4.3).
 */
const express = require('express');

const authRoutes = require('./auth.routes');
const usersRoutes = require('./users.routes');
const boardsRoutes = require('./boards.routes');
const threadsRoutes = require('./threads.routes');
const repliesRoutes = require('./replies.routes');
const reportsRoutes = require('./reports.routes');
const moderationRoutes = require('./moderation.routes');
const chatRoutes = require('./chat.routes');
const crisisRoutes = require('./crisis.routes');
const notificationsRoutes = require('./notifications.routes');

const router = express.Router();

router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'AdiYogi API',
    data: { version: 'v1', documentation: '/api/docs' },
    meta: {},
  });
});

router.use('/auth', authRoutes);
router.use('/users', usersRoutes);
router.use('/boards', boardsRoutes);
router.use('/threads', threadsRoutes);
router.use('/replies', repliesRoutes);
router.use('/reports', reportsRoutes);
router.use('/moderation', moderationRoutes);
router.use('/chat', chatRoutes);
router.use('/crisis', crisisRoutes);
router.use('/notifications', notificationsRoutes);

module.exports = router;
