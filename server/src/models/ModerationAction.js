'use strict';

/**
 * ModerationAction — append-only audit log of moderator actions (content and report
 * lifecycle). Every action is attributed to a User moderator; the referenced user is
 * exposed only as `{id, displayName}` in the public projection (§12.7), and only when the
 * controller populates the `moderator` path.
 */
const { Schema, model } = require('mongoose');
const { refId, publicJSONOptions } = require('./lib/helpers');

const MODERATION_ACTIONS = [
  'hide',
  'unhide',
  'delete',
  'pin',
  'unpin',
  'lock',
  'unlock',
  'report_review',
  'report_resolve',
  'report_dismiss',
];

const moderationActionSchema = new Schema(
  {
    moderator: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'moderator is required'],
    },
    action: {
      type: String,
      enum: {
        values: MODERATION_ACTIONS,
        message: `action must be one of ${MODERATION_ACTIONS.join(', ')}`,
      },
      required: [true, 'action is required'],
    },
    targetType: {
      type: String,
      enum: ['thread', 'reply', 'report'],
      required: [true, 'targetType is required'],
    },
    targetId: { type: Schema.Types.ObjectId, required: [true, 'targetId is required'] },
    reportId: { type: Schema.Types.ObjectId, ref: 'Report', default: null },
    reason: {
      type: String,
      required: [true, 'reason is required'],
      trim: true,
      maxlength: [500, 'reason must be 500 characters or fewer'],
    },
    // Small, non-content operational payload (e.g. previous status). Never store message text.
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

moderationActionSchema.index({ createdAt: -1 });
moderationActionSchema.index({ moderator: 1 });
moderationActionSchema.index({ targetType: 1, targetId: 1 });

/**
 * Frozen §12.7 shape. Map a populated moderator to `{id, displayName}`; if the controller
 * did not populate it, emit the raw id with `displayName: null`.
 * @returns {object}
 */
moderationActionSchema.methods.toPublicJSON = function toPublicJSON() {
  const moderator = this.moderator;
  const isPopulated = Boolean(moderator && typeof moderator === 'object' && moderator._id);
  return {
    id: this._id ? String(this._id) : null,
    action: this.action,
    targetType: this.targetType,
    targetId: refId(this.targetId),
    reportId: refId(this.reportId),
    reason: this.reason,
    moderator: {
      id: refId(moderator),
      displayName: isPopulated ? moderator.displayName || null : null,
    },
    createdAt: this.createdAt,
  };
};

moderationActionSchema.set('toJSON', publicJSONOptions());

const ModerationAction = model('ModerationAction', moderationActionSchema);
ModerationAction.MODERATION_ACTIONS = MODERATION_ACTIONS;

module.exports = ModerationAction;
