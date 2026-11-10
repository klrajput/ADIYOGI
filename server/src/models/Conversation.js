'use strict';

/**
 * Conversation — a private AI-companion chat session owned by exactly one identity.
 *
 * Retention: `expiresAt` is computed from CHAT_RETENTION_DAYS and enforced by a TTL index
 * (expireAfterSeconds: 0), so chat history purges itself without a cron job (§5, §7).
 * `DELETE /chat/conversations/:id` is a hard delete (privacy), so `status` has no
 * 'deleted' value: 'archived' is a user-visible soft state only.
 *
 * Serialization (§12.7): `ownerType`/`ownerId` are internal and are never emitted.
 */
const { Schema, model } = require('mongoose');
const { chatExpiry, publicJSONOptions } = require('./lib/helpers');

const conversationSchema = new Schema(
  {
    ownerType: {
      type: String,
      enum: ['session', 'user'],
      required: [true, 'ownerType is required'],
    },
    ownerId: { type: Schema.Types.ObjectId, required: [true, 'ownerId is required'] },
    title: {
      type: String,
      trim: true,
      maxlength: [120, 'title must be 120 characters or fewer'],
      default: 'New conversation',
    },
    messageCount: { type: Number, default: 0, min: 0 },
    lastMessageAt: { type: Date, default: () => new Date() },
    riskLevel: {
      type: String,
      enum: ['none', 'low', 'elevated', 'high'],
      default: 'none',
    },
    status: {
      type: String,
      enum: ['active', 'archived'],
      default: 'active',
    },
    // TTL retention marker (CHAT_RETENTION_DAYS).
    expiresAt: { type: Date },
  },
  { timestamps: true }
);

conversationSchema.index({ ownerId: 1, lastMessageAt: -1 });
conversationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

conversationSchema.pre('save', function setConversationExpiry(next) {
  if (!this.expiresAt) this.expiresAt = chatExpiry();
  next();
});

/**
 * Frozen §12.7 shape.
 * @returns {object}
 */
conversationSchema.methods.toPublicJSON = function toPublicJSON() {
  return {
    id: this._id ? String(this._id) : null,
    title: this.title,
    messageCount: this.messageCount,
    lastMessageAt: this.lastMessageAt,
    riskLevel: this.riskLevel,
    status: this.status,
    createdAt: this.createdAt,
  };
};

conversationSchema.set('toJSON', publicJSONOptions());

module.exports = model('Conversation', conversationSchema);
