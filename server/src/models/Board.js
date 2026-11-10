'use strict';

/**
 * Board — forum category. Boards are seeded from server/src/data/boards.seed.js and can
 * then be managed by admins; the counters are live aggregates maintained by services and
 * must never be overwritten by seeding.
 *
 * Serialization: boards are public data, so `toJSON()` = `toPublicJSON()` (§12.7 shape).
 */
const { Schema, model } = require('mongoose');
const { normalizeTags, publicJSONOptions } = require('./lib/helpers');

const SLUG_PATTERN = /^[a-z0-9-]+$/;

const boardSchema = new Schema(
  {
    slug: {
      type: String,
      required: [true, 'slug is required'],
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: [60, 'slug must be 60 characters or fewer'],
      match: [SLUG_PATTERN, 'slug may contain lowercase letters, numbers and hyphens only'],
    },
    name: {
      type: String,
      required: [true, 'name is required'],
      trim: true,
      minlength: [2, 'name must be at least 2 characters'],
      maxlength: [80, 'name must be 80 characters or fewer'],
    },
    // Admin quick-create may leave presentation fields empty; the seed always populates them.
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'description must be 500 characters or fewer'],
      default: '',
    },
    // A single emoji (or a short icon token) shown in the board list.
    icon: {
      type: String,
      trim: true,
      maxlength: [16, 'icon must be a single emoji'],
      default: '',
    },
    supportLevel: {
      type: String,
      enum: {
        values: ['general', 'peer', 'crisis'],
        message: 'supportLevel must be one of general, peer, crisis',
      },
      default: 'general',
    },
    guidelines: {
      type: [String],
      default: [],
      validate: [
        {
          validator: (guidelines) => guidelines.length <= 8,
          message: 'a board may have at most 8 guidelines',
        },
        {
          validator: (guidelines) => guidelines.every((entry) => String(entry).length <= 300),
          message: 'each guideline must be 300 characters or fewer',
        },
      ],
    },
    tags: {
      type: [String],
      default: [],
      validate: [
        {
          validator: (tags) => tags.length <= 12,
          message: 'a board may have at most 12 tags',
        },
        {
          validator: (tags) => tags.every((tag) => String(tag).length <= 30),
          message: 'each tag must be 30 characters or fewer',
        },
      ],
    },
    order: { type: Number, default: 0, min: 0 },
    isActive: { type: Boolean, default: true },
    // Live counters, maintained by services; seed/upsert must never overwrite them.
    threadCount: { type: Number, default: 0, min: 0 },
    replyCount: { type: Number, default: 0, min: 0 },
    lastActivityAt: { type: Date, default: null },
  },
  { timestamps: true }
);

boardSchema.index({ order: 1 });

/** Trim tags/guidelines before validation so whitespace duplicates collapse. */
boardSchema.pre('validate', function normalizeBoard(next) {
  if (Array.isArray(this.tags)) this.tags = normalizeTags(this.tags);
  if (Array.isArray(this.guidelines)) {
    this.guidelines = this.guidelines.map((entry) => String(entry).trim()).filter(Boolean);
  }
  next();
});

/**
 * Frozen §12.7 shape.
 * @returns {object}
 */
boardSchema.methods.toPublicJSON = function toPublicJSON() {
  return {
    id: this._id ? String(this._id) : null,
    slug: this.slug,
    name: this.name,
    description: this.description,
    icon: this.icon,
    supportLevel: this.supportLevel,
    guidelines: Array.isArray(this.guidelines) ? [...this.guidelines] : [],
    tags: Array.isArray(this.tags) ? [...this.tags] : [],
    order: this.order,
    threadCount: this.threadCount,
    replyCount: this.replyCount,
    lastActivityAt: this.lastActivityAt,
    createdAt: this.createdAt,
  };
};

boardSchema.set('toJSON', publicJSONOptions());

module.exports = model('Board', boardSchema);
