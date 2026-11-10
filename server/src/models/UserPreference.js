'use strict';

/**
 * UserPreference — UI/identity preferences for exactly one owner.
 *
 * `ownerType`/`ownerId` are an internal (type, id) pair so anonymous sessions and
 * registered users share one collection without a polymorphic ref. The ownership
 * references are never serialized (ARCHITECTURE §12.7).
 */
const { Schema, model } = require('mongoose');
const { publicJSONOptions } = require('./lib/helpers');

const userPreferenceSchema = new Schema(
  {
    ownerType: {
      type: String,
      enum: ['session', 'user'],
      required: [true, 'ownerType is required'],
    },
    ownerId: {
      type: Schema.Types.ObjectId,
      required: [true, 'ownerId is required'],
    },
    displayAlias: {
      type: String,
      trim: true,
      minlength: [2, 'displayAlias must be at least 2 characters'],
      maxlength: [40, 'displayAlias must be 40 characters or fewer'],
      default: null,
    },
    showCrisisBar: { type: Boolean, default: true },
    contentWarningDefault: { type: Boolean, default: false },
    reduceMotion: { type: Boolean, default: false },
  },
  { timestamps: true }
);

userPreferenceSchema.index({ ownerType: 1, ownerId: 1 }, { unique: true });

/**
 * Frozen §12.7 shape — the four documented preferences plus `updatedAt`.
 * @returns {object}
 */
userPreferenceSchema.methods.toPublicJSON = function toPublicJSON() {
  return {
    displayAlias: this.displayAlias ?? null,
    showCrisisBar: this.showCrisisBar,
    contentWarningDefault: this.contentWarningDefault,
    reduceMotion: this.reduceMotion,
    updatedAt: this.updatedAt,
  };
};

userPreferenceSchema.set('toJSON', publicJSONOptions());

module.exports = model('UserPreference', userPreferenceSchema);
