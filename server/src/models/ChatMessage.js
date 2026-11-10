'use strict';

/**
 * ChatMessage — one persisted turn of an AI-companion conversation.
 *
 * Content is sensitive: it is only ever returned to the conversation owner by the chat
 * controller. Retention mirrors the parent Conversation (`CHAT_RETENTION_DAYS` TTL) so a
 * conversation's messages disappear together even if the parent is missed.
 */
const { Schema, model } = require('mongoose');
const { chatExpiry, refId, publicJSONOptions } = require('./lib/helpers');

const chatMessageSchema = new Schema(
  {
    conversation: {
      type: Schema.Types.ObjectId,
      ref: 'Conversation',
      required: [true, 'conversation is required'],
    },
    role: {
      type: String,
      enum: ['user', 'assistant'],
      required: [true, 'role is required'],
    },
    content: {
      type: String,
      required: [true, 'content is required'],
      trim: true,
      minlength: [1, 'content must not be empty'],
      maxlength: [2000, 'content must be 2000 characters or fewer'],
    },
    riskLevel: {
      type: String,
      enum: ['none', 'low', 'elevated', 'high'],
      default: 'none',
    },
    // Provider id recorded for audit: 'gemini' for real AI turns, 'none' for user turns
    // and server-generated safety messages. Deliberately not an enum — AI_PROVIDER is
    // configurable, so a new provider must not require a schema migration.
    aiProvider: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: [32, 'aiProvider must be 32 characters or fewer'],
      default: null,
    },
    aiModel: { type: String, trim: true, maxlength: 80, default: null },
    // TTL retention marker (CHAT_RETENTION_DAYS).
    expiresAt: { type: Date },
  },
  { timestamps: true }
);

chatMessageSchema.index({ conversation: 1, createdAt: 1 });
chatMessageSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

chatMessageSchema.pre('save', function setMessageExpiry(next) {
  if (!this.expiresAt) this.expiresAt = chatExpiry();
  next();
});

/**
 * Frozen §12.7 shape.
 * @returns {object}
 */
chatMessageSchema.methods.toPublicJSON = function toPublicJSON() {
  return {
    id: this._id ? String(this._id) : null,
    conversation: refId(this.conversation),
    role: this.role,
    content: this.content,
    riskLevel: this.riskLevel,
    aiProvider: this.aiProvider ?? null,
    aiModel: this.aiModel ?? null,
    createdAt: this.createdAt,
  };
};

chatMessageSchema.set('toJSON', publicJSONOptions());

module.exports = model('ChatMessage', chatMessageSchema);
