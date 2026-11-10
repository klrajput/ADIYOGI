'use strict';

/**
 * Report — a user-submitted abuse report against a thread or reply.
 *
 * One report per (targetType, targetId, reporter) is enforced by a unique compound index;
 * the service maps Mongo's E11000 to `409 CONFLICT`. `reportedBy` and `reviewedBy` are
 * identity/ moderation refs and are never serialized (§12.7).
 */
const { Schema, model } = require('mongoose');
const { refId, publicJSONOptions, viewerOwns } = require('./lib/helpers');

const REPORT_REASONS = [
  'spam',
  'harassment',
  'self_harm_risk',
  'graphic',
  'medical_misinformation',
  'other',
];

const reportSchema = new Schema(
  {
    targetType: {
      type: String,
      enum: ['thread', 'reply'],
      required: [true, 'targetType is required'],
    },
    targetId: { type: Schema.Types.ObjectId, required: [true, 'targetId is required'] },
    // Owning thread, so moderators can navigate from a reply report to its thread.
    targetThread: { type: Schema.Types.ObjectId, ref: 'Thread', default: null },
    // Session or User id (opaque; never serialized).
    reportedBy: { type: Schema.Types.ObjectId, required: [true, 'reportedBy is required'] },
    reason: {
      type: String,
      enum: {
        values: REPORT_REASONS,
        message: `reason must be one of ${REPORT_REASONS.join(', ')}`,
      },
      required: [true, 'reason is required'],
    },
    details: { type: String, trim: true, maxlength: [500, 'details must be 500 characters or fewer'], default: null },
    status: {
      type: String,
      enum: ['open', 'reviewing', 'resolved', 'dismissed'],
      default: 'open',
    },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    reviewedAt: { type: Date, default: null },
    resolutionNote: {
      type: String,
      trim: true,
      maxlength: [500, 'resolutionNote must be 500 characters or fewer'],
      default: null,
    },
  },
  { timestamps: true }
);

// Moderator queue: oldest open reports first.
reportSchema.index({ status: 1, createdAt: -1 });
// One report per reporter per target (prevents report spam, ARCHITECTURE §4.3).
reportSchema.index({ targetType: 1, targetId: 1, reportedBy: 1 }, { unique: true });

/**
 * Frozen §12.7 shape. `isOwner` means "the caller filed this report".
 * @param {{viewerId?:string}} [options]
 * @returns {object}
 */
reportSchema.methods.toPublicJSON = function toPublicJSON(options = {}) {
  return {
    id: this._id ? String(this._id) : null,
    targetType: this.targetType,
    targetId: refId(this.targetId),
    targetThread: refId(this.targetThread),
    reason: this.reason,
    details: this.details,
    status: this.status,
    createdAt: this.createdAt,
    isOwner: viewerOwns(this.reportedBy, options.viewerId),
  };
};

reportSchema.set('toJSON', publicJSONOptions());

const Report = model('Report', reportSchema);
Report.REPORT_REASONS = REPORT_REASONS;

module.exports = Report;
