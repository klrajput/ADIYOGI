'use strict';

/**
 * Notification controllers (`/api/v1/notifications`, docs/ARCHITECTURE.md §4.3, §4.4).
 */
const { ok } = require('../utils/response');
const notificationService = require('../services/notificationService');

/**
 * GET /notifications
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<import('express').Response>}
 */
async function list(req, res) {
  const { notifications, meta } = await notificationService.listNotifications({
    identity: req.identity,
    query: req.query,
  });
  return ok(res, { notifications }, { message: 'Notifications', meta });
}

/**
 * PATCH /notifications/:id/read
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<import('express').Response>}
 */
async function markRead(req, res) {
  const notification = await notificationService.markRead({ identity: req.identity, id: req.params.id });
  return ok(res, { notification: notification.toPublicJSON() }, { message: 'Notification read' });
}

/**
 * POST /notifications/read-all
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<import('express').Response>}
 */
async function markAllRead(req, res) {
  const { updated } = await notificationService.markAllRead({ identity: req.identity });
  return ok(res, { updated }, { message: 'All notifications marked read' });
}

module.exports = { list, markRead, markAllRead };
