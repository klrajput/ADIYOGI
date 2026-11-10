'use strict';

/**
 * Thread — a forum post. `authorType`/`authorId`/`authorModel`/`authorAlias` snapshot the
 * author at creation time so the API can show an alias without ever joining to an identity
 * collection. `authorId`/`authorModel` are never serialized (§12.7); ownership checks
 * compare `authorId` with `viewerId` server-side only.
 *
 * `excerpt` is derived from `body` in a pre-validate hook when the caller does not supply
 * one (and is refreshed when the body is edited without an explicit excerpt).
 */
const { Schema, model } = require('mongoose');
const {
  deriveExcerpt,
  isWithinEditWindow,
  normalizeTags,
  publicJSONOptions,
  viewerIsPrivileged,
  viewerOwns,
} = require('./lib/helpers');

const threadSchema = new Schema(
  {
    board: {
      type: Schema.Types.ObjectId,
      ref: 'Board',
      required: [true, 'board is required'],
    },
    boardSlug: {
      type: String,
      required: [true, 'boardSlug is required'],
      lowercase: true,
      trim: true,
      maxlength: [60, 'boardSlug must be 60 characters or fewer'],
    },
    title: {
      type: String,
      required: [true, 'title is required'],
      trim: true,
      minlength: [3, 'title must be at least 3 characters'],
      maxlength: [160, 'title must be 160 characters or fewer'],
    },
    body: {
      type: String,
      required: [true, 'body is required'],
      trim: true,
      minlength: [1, 'body must not be empty'],
      maxlength: [5000, 'body must be 5000 characters or fewer'],
    },
    excerpt: {
      type: String,
      trim: true,
      maxlength: [300, 'excerpt must be 300 characters or fewer'],
      default: '',
    },
    contentWarning: { type: Boolean, default: false },
    tags: {
      type: [String],
      default: [],
      validate: [
        { validator: (tags) => tags.length <= 6, message: 'a thread may have at most 6 tags' },
        {
          validator: (tags) => tags.every((tag) => String(tag).length <= 30),
          message: 'each tag must be 30 characters or fewer',
        },
      ],
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
    status: {
      type: String,
      enum: ['published', 'hidden', 'removed', 'deleted'],
      default: 'published',
    },
    isPinned: { type: Boolean, default: false },
    isLocked: { type: Boolean, default: false },
    replyCount: { type: Number, default: 0, min: 0 },
    viewCount: { type: Number, default: 0, min: 0 },
    lastActivityAt: { type: Date, default: () => new Date() },
    moderatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    moderationReason: { type: String, trim: true, maxlength: 500, default: null },
    editedAt: { type: Date, default: null },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Board listing: filter by board + status, pinned first, then most recent activity.
threadSchema.index({ boardSlug: 1, status: 1, isPinned: -1, lastActivityAt: -1 });
// "My content" / moderation lookups by author.
threadSchema.index({ authorId: 1 });
// Global "newest" listing.
threadSchema.index({ createdAt: -1 });
// Full-text search over title + body; titles weigh more than bodies.
threadSchema.index(
  { title: 'text', body: 'text' },
  { name: 'thread_search', weights: { title: 10, body: 4 }, default_language: 'english' }
);

/** Derive excerpt, normalise tags and stamp editedAt on meaningful edits. */
threadSchema.pre('validate', function prepareThread(next) {
  if (Array.isArray(this.tags)) this.tags = normalizeTags(this.tags);
  if (!this.excerpt || (this.isModified('body') && !this.isModified('excerpt'))) {
    this.excerpt = deriveExcerpt(this.body);
  }
  next();
});

threadSchema.pre('save', function stampEdit(next) {
  if (!this.isNew && !this.isModified('editedAt')) {
    const edited = ['title', 'body', 'tags', 'contentWarning'].some((field) => this.isModified(field));
    if (edited) this.editedAt = new Date();
  }
  next();
});

/**
 * Frozen §12.7 shape. `viewerId` is `identity.userId` for accounts and
 * `identity.sessionId` for anonymous sessions; `isModerator: true` (or role) widens canDelete.
 * @param {{viewerId?:string, isModerator?:boolean, role?:string}} [options]
 * @returns {object}
 */
threadSchema.methods.toPublicJSON = function toPublicJSON(options = {}) {
  const isOwner = viewerOwns(this.authorId, options.viewerId);
  const canDelete = isOwner || viewerIsPrivileged(options);
  const canEdit = isOwner && this.status === 'published' && isWithinEditWindow(this.createdAt);
  // Present only when the caller populated the board ref (list/detail views).
  const populatedBoard = this.board && typeof this.board === 'object' ? this.board : null;

  return {
    id: this._id ? String(this._id) : null,
    boardSlug: this.boardSlug,
    ...(populatedBoard && populatedBoard.name ? { boardName: populatedBoard.name } : {}),
    title: this.title,
    body: this.body,
    excerpt: this.excerpt,
    contentWarning: this.contentWarning,
    tags: Array.isArray(this.tags) ? [...this.tags] : [],
    author: { alias: this.authorAlias, type: this.authorType },
    status: this.status,
    isPinned: this.isPinned,
    isLocked: this.isLocked,
    replyCount: this.replyCount,
    viewCount: this.viewCount,
    lastActivityAt: this.lastActivityAt,
    editedAt: this.editedAt,
    createdAt: this.createdAt,
    isOwner,
    canEdit,
    canDelete,
  };
};

threadSchema.set('toJSON', publicJSONOptions());

module.exports = model('Thread', threadSchema);
