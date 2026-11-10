'use strict';

/**
 * Notification service (docs/ARCHITECTURE.md §12.4: `notifyThreadReply`).
 *
 * Notifications never contain post/reply content — only a generic message and the
 * ids of the related documents, so a user's notification list cannot leak content
 * they are no longer allowed to see. Delivery failures are logged, never surfaced:
 * a reply must succeed even if the notification could not be written.
 */
const Notification = require('../models/Notification');
const logger = require('../config/logger');
const ApiError = require('../utils/ApiError');
const { getPagination, buildMeta } = require('../utils/pagination');
const { viewerIdOf, recipientOf } = require('../utils/domain/identity');

const THREAD_REPLY_MESSAGE = 'Someone replied to your thread';

/**
 * Notify a thread author that their thread received a reply.
 * @param {{thread: object, reply: object, actor: object}} input
 * @returns {Promise<boolean>} true when a notification was created
 */
async function notifyThreadReply({ thread, reply, actor }) {
  try {
    if (!thread || !reply) return false;
    const recipientId = String(thread.authorId);
    if (!recipientId || recipientId === viewerIdOf(actor)) return false;

    await Notification.create({
      recipientType: thread.authorType === 'user' ? 'user' : 'session',
      recipientId,
      type: 'thread_reply',
      thread: thread._id,
      reply: reply._id,
      read: false,
      message: THREAD_REPLY_MESSAGE,
    });
    return true;
  } catch (error) {
    logger.warn('notifications.thread_reply_failed', { code: error && error.code });
    return false;
  }
}

/**
 * Paginated notification list for the caller.
 * @param {{identity: object, query: object}} input
 * @returns {Promise<{notifications: object[], meta: object}>}
 */
async function listNotifications({ identity, query }) {
  const { recipientType, recipientId } = recipientOf(identity);
  const { page, limit, skip } = getPagination(query);
  const filter = { recipientType, recipientId };
  if (query.unreadOnly) filter.read = false;

  const [documents, total, unreadCount] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Notification.countDocuments(filter),
    Notification.countDocuments({ recipientType, recipientId, read: false }),
  ]);

  return {
    notifications: documents.map((document) => document.toPublicJSON({ viewerId: recipientId })),
    // `unreadCount` respects the caller's recipient scope (and therefore the filter).
    meta: { ...buildMeta({ page, limit, total }), unreadCount },
  };
}

/**
 * Mark one of the caller's notifications as read.
 * @param {{identity: object, id: string}} input
 * @returns {Promise<object>} updated Notification document
 */
async function markRead({ identity, id }) {
  const { recipientType, recipientId } = recipientOf(identity);
  const notification = await Notification.findOne({ _id: id, recipientType, recipientId });
  if (!notification) throw ApiError.notFound('Notification not found');

  if (!notification.read) {
    notification.read = true;
    await notification.save();
  }
  return notification;
}

/**
 * Mark every unread notification of the caller as read.
 * @param {{identity: object}} input
 * @returns {Promise<{updated: number}>}
 */
async function markAllRead({ identity }) {
  const { recipientType, recipientId } = recipientOf(identity);
  const result = await Notification.updateMany(
    { recipientType, recipientId, read: false },
    { $set: { read: true } }
  );
  return { updated: result.modifiedCount || 0 };
}

module.exports = { notifyThreadReply, listNotifications, markRead, markAllRead };
