'use strict';

/**
 * CrisisEvent — privacy-preserving crisis metadata.
 *
 * IMPORTANT: this collection must NEVER gain a field that can hold message/user text.
 * The crisis contract (§7, §8) stores only the assessed level, where the trigger came
 * from, machine-readable reason codes, whether resources were shown, and the country used
 * to choose helplines. The original text is assessed in memory and discarded.
 *
 * Retention: `expiresAt` = CRISIS_EVENT_RETENTION_DAYS, enforced by a TTL index.
 * Serialization: crisis events are never sent to clients (§12.7); metadata-only theses
 * can never carry content.
 */
const { Schema, model } = require('mongoose');
const { crisisExpiry, publicJSONOptions } = require('./lib/helpers');

const crisisEventSchema = new Schema(
  {
    session: {
      type: Schema.Types.ObjectId,
      ref: 'Session',
      required: [true, 'session is required'],
    },
    level: {
      type: String,
      enum: ['none', 'low', 'elevated', 'high'],
      required: [true, 'level is required'],
    },
    source: {
      type: String,
      enum: ['manual', 'chat', 'content', 'assessment'],
      required: [true, 'source is required'],
    },
    // Machine-readable assessment reason codes only (e.g. 'self_harm_phrase'); never text.
    triggerCodes: {
      type: [String],
      default: [],
      validate: [
        {
          validator: (codes) => codes.length <= 20,
          message: 'at most 20 trigger codes may be stored',
        },
        {
          validator: (codes) => codes.every((code) => String(code).length <= 64),
          message: 'each trigger code must be 64 characters or fewer',
        },
      ],
    },
    resourcesShown: { type: Boolean, default: false },
    // ISO-3166 alpha-2 for a known region, or 'INTL' for the international fallback.
    country: { type: String, trim: true, uppercase: true, maxlength: 8, default: null },
    // TTL retention marker (CRISIS_EVENT_RETENTION_DAYS). No content fields belong here.
    expiresAt: { type: Date },
  },
  { timestamps: true }
);

crisisEventSchema.index({ createdAt: -1 });
crisisEventSchema.index({ level: 1, createdAt: -1 });
crisisEventSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

crisisEventSchema.pre('save', function setCrisisExpiry(next) {
  if (!this.expiresAt) this.expiresAt = crisisExpiry();
  next();
});

/**
 * Metadata-only projection. Never includes the session ref or anything derived from text.
 * @returns {object}
 */
crisisEventSchema.methods.toPublicJSON = function toPublicJSON() {
  return {
    level: this.level,
    source: this.source,
    triggerCodes: Array.isArray(this.triggerCodes) ? [...this.triggerCodes] : [],
    resourcesShown: this.resourcesShown,
    country: this.country,
    createdAt: this.createdAt,
  };
};

crisisEventSchema.set('toJSON', publicJSONOptions());

module.exports = model('CrisisEvent', crisisEventSchema);
