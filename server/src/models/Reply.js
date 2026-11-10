'use strict';

/**
 * Reply — one message inside a Thread (flat list, individually paginatable and moderatable;
 * fixes audit D-2). Author identity snapshot semantics match Thread.
 *
 * Serialization (§12.7): `authorId`/`authorModel`/`moderatedBy` never leave the server;
 * `isOwner`/`canDelete` are computed from the server-side identity id.
 */
const { Schema, model } = require('mongoose');
const {
  refId,
  publicJSONOptions,
  viewerIsPrivileged,
  viewerOwns,
} = require('./lib/helpers');

const replySchema = new Schema(
  {
    thread: {
      type: Schema.Types.ObjectId,
      ref: 'Thread',
      required: [true, 'thread is required'],
    },
    authorType: {
      type: String,
      enum: ['anonymous', 'user'],
      required: [true, 'authorType is required'],
      default: 'anonymous',
    },
    authorId: { type: Schema.Types.ObjectId, required: [true, 'authorId is required'] },
    authorModel: {
      type: String,
      enum: ['Session', 'User'],
      required: [true, 'authorModel is required'],
    },
    authorAlias: {
      type: String,
      required: [true, 'authorAlias is required'],
      trim: true,
      minlength: [2, 'authorAlias must be at least 2 characters'],
      maxlength: [40, 'authorAlias must be 40 characters or fewer'],
    },
    body: {
      type: String,
      required: [true, 'body is required'],
      trim: true,
      minlength: [1, 'body must not be empty'],
      maxlength: [3000, 'body must be 3000 characters or fewer'],
    },
    contentWarning: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ['published', 'hidden', 'removed', 'deleted'],
      default: 'published',
    },
    moderatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    moderationReason: { type: String, trim: true, maxlength: 500, default: null },
    editedAt: { type: Date, default: null },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Thread detail: paginate/sort replies of one thread by visibility + chronological order.
replySchema.index({ thread: 1, status: 1, createdAt: 1 });
// "My content" / moderation lookups by author.
replySchema.index({ authorId: 1 });

replySchema.pre('save', function stampEdit(next) {
  if (!this.isNew && this.isModified('body') && !this.isModified('editedAt')) {
    this.editedAt = new Date();
  }
  next();
});

/**
 * Frozen §12.7 shape.
 * @param {{viewerId?:string, isModerator?:boolean, role?:string}} [options]
 * @returns {object}
 */
replySchema.methods.toPublicJSON = function toPublicJSON(options = {}) {
  const isOwner = viewerOwns(this.authorId, options.viewerId);
  return {
    id: this._id ? String(this._id) : null,
    thread: refId(this.thread),
    body: this.body,
    contentWarning: this.contentWarning,
    author: { alias: this.authorAlias, type: this.authorType },
    status: this.status,
    createdAt: this.createdAt,
    editedAt: this.editedAt,
    isOwner,
    canDelete: isOwner || viewerIsPrivileged(options),
  };
};

replySchema.set('toJSON', publicJSONOptions());

module.exports = model('Reply', replySchema);
