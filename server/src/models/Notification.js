'use strict';

/**
 * Notification — in-app notification for the owner of a thread/reply (or a moderator
 * announcement). Recipients are addressed by (type, id) so anonymous sessions and user
 * accounts share one collection. `recipientType`/`recipientId` are never serialized and
 * the TTL index keeps the inbox bounded (90 days, ARCHITECTURE §5).
 */
const { Schema, model } = require('mongoose');
const { notificationExpiry, refId, publicJSONOptions } = require('./lib/helpers');

const notificationSchema = new Schema(
  {
    recipientType: {
      type: String,
      enum: ['session', 'user'],
      required: [true, 'recipientType is required'],
    },
    recipientId: {
      type: Schema.Types.ObjectId,
      required: [true, 'recipientId is required'],
    },
    type: {
      type: String,
      enum: ['thread_reply', 'moderation', 'system'],
      required: [true, 'type is required'],
    },
    thread: { type: Schema.Types.ObjectId, ref: 'Thread', default: null },
    reply: { type: Schema.Types.ObjectId, ref: 'Reply', default: null },
    read: { type: Boolean, default: false },
    message: {
      type: String,
      required: [true, 'message is required'],
      trim: true,
      maxlength: [300, 'message must be 300 characters or fewer'],
    },
    // TTL retention marker (90 days); never set manually.
    expiresAt: { type: Date },
  },
  { timestamps: true }
);

// Inbox query: unread first, newest first.
notificationSchema.index({ recipientId: 1, read: 1, createdAt: -1 });
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

notificationSchema.pre('save', function setNotificationExpiry(next) {
  if (!this.expiresAt) this.expiresAt = notificationExpiry();
  next();
});

/**
 * Frozen §12.7 shape.
 * @returns {object}
 */
notificationSchema.methods.toPublicJSON = function toPublicJSON() {
  return {
    id: this._id ? String(this._id) : null,
    type: this.type,
    message: this.message,
    thread: refId(this.thread),
    reply: refId(this.reply),
    read: this.read,
    createdAt: this.createdAt,
  };
};

notificationSchema.set('toJSON', publicJSONOptions());

module.exports = model('Notification', notificationSchema);
