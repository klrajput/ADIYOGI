/**
 * Shape normalisers for API payloads.
 *
 * The frozen contract (docs/ARCHITECTURE.md §4.3/§4.4) returns entities under
 * named keys, e.g. `{ data: { thread: {...} } }`. These helpers keep the UI
 * resilient to small, additive differences (array vs. named key, `_id` vs `id`,
 * missing optional fields) without ever inventing missing data: unknown counts
 * stay `null` and are simply not rendered.
 */
import { truncate } from './format';

const isObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

function pick(object, keys) {
  for (const key of keys) {
    if (object && object[key] !== undefined && object[key] !== null) return object[key];
  }
  return undefined;
}

/** Accepts `data` and returns the entity (unwrapping a named key when present). */
export function asEntity(data, keys = []) {
  if (!isObject(data)) return null;
  return pick(data, keys) ?? data;
}

/** Accepts `data` and always returns an array. */
export function asList(data, keys = []) {
  if (Array.isArray(data)) return data;
  if (!isObject(data)) return [];
  for (const key of keys) {
    if (Array.isArray(data[key])) return data[key];
  }
  return [];
}

/** A finite number or `null` — never a fabricated zero. */
export function toNumberOrNull(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/** A finite number or `0` for fields that default to zero on the server. */
export function toNumberOrZero(value) {
  return toNumberOrNull(value) ?? 0;
}

export function normalizeMeta(meta) {
  if (!isObject(meta)) return null;
  const page = toNumberOrNull(meta.page) ?? 1;
  const limit = toNumberOrNull(meta.limit) ?? 0;
  const total = toNumberOrNull(meta.total) ?? 0;
  const totalPages = toNumberOrNull(meta.totalPages) ?? (limit > 0 ? Math.ceil(total / limit) : 0);
  return {
    page,
    limit,
    total,
    totalPages,
    hasNext: typeof meta.hasNext === 'boolean' ? meta.hasNext : page < totalPages,
    hasPrev: typeof meta.hasPrev === 'boolean' ? meta.hasPrev : page > 1,
    unreadCount: toNumberOrNull(meta.unreadCount),
  };
}

export function normalizeBoard(raw) {
  if (!isObject(raw)) return null;
  const slug = String(pick(raw, ['slug']) || '');
  return {
    id: String(pick(raw, ['id', '_id']) || slug),
    slug,
    name: String(pick(raw, ['name']) || 'Untitled board'),
    description: String(pick(raw, ['description']) || ''),
    icon: typeof raw.icon === 'string' ? raw.icon : '',
    supportLevel: pick(raw, ['supportLevel']) || 'general',
    guidelines: Array.isArray(raw.guidelines) ? raw.guidelines.filter((entry) => typeof entry === 'string') : [],
    tags: Array.isArray(raw.tags) ? raw.tags.filter((entry) => typeof entry === 'string') : [],
    threadCount: toNumberOrNull(raw.threadCount),
    replyCount: toNumberOrNull(raw.replyCount),
    lastActivityAt: pick(raw, ['lastActivityAt']) || null,
    order: toNumberOrNull(raw.order),
  };
}

export function normalizeThread(raw) {
  if (!isObject(raw)) return null;
  const board = isObject(raw.board) ? raw.board : null;
  const author = isObject(raw.author) ? raw.author : null;
  const body = typeof raw.body === 'string' ? raw.body : '';
  const isOwner = Boolean(raw.isOwner);
  return {
    id: String(pick(raw, ['id', '_id']) || ''),
    boardSlug: String(pick(raw, ['boardSlug']) || board?.slug || ''),
    boardName: String(pick(raw, ['boardName']) || board?.name || ''),
    boardIcon: typeof board?.icon === 'string' ? board.icon : '',
    title: String(pick(raw, ['title']) || ''),
    body,
    excerpt: typeof raw.excerpt === 'string' && raw.excerpt ? raw.excerpt : truncate(body, 180),
    contentWarning: Boolean(raw.contentWarning),
    tags: Array.isArray(raw.tags) ? raw.tags.filter((tag) => typeof tag === 'string') : [],
    authorAlias: String(pick(raw, ['authorAlias', 'alias']) || author?.alias || 'Anonymous'),
    status: typeof raw.status === 'string' ? raw.status : 'published',
    isPinned: Boolean(raw.isPinned),
    isLocked: Boolean(raw.isLocked),
    isOwner,
    canEdit: typeof raw.canEdit === 'boolean' ? raw.canEdit : false,
    canDelete: typeof raw.canDelete === 'boolean' ? raw.canDelete : isOwner,
    replyCount: toNumberOrNull(raw.replyCount),
    viewCount: toNumberOrNull(raw.viewCount),
    createdAt: pick(raw, ['createdAt']) || null,
    lastActivityAt: pick(raw, ['lastActivityAt', 'createdAt']) || null,
    editedAt: pick(raw, ['editedAt']) || null,
  };
}

export function normalizeReply(raw) {
  if (!isObject(raw)) return null;
  const author = isObject(raw.author) ? raw.author : null;
  const isOwner = Boolean(raw.isOwner);
  return {
    id: String(pick(raw, ['id', '_id']) || ''),
    body: typeof raw.body === 'string' ? raw.body : '',
    authorAlias: String(pick(raw, ['authorAlias', 'alias']) || author?.alias || 'Anonymous'),
    contentWarning: Boolean(raw.contentWarning),
    status: typeof raw.status === 'string' ? raw.status : 'published',
    isOwner,
    canDelete: typeof raw.canDelete === 'boolean' ? raw.canDelete : isOwner,
    createdAt: pick(raw, ['createdAt']) || null,
    editedAt: pick(raw, ['editedAt']) || null,
  };
}

export function normalizeNotification(raw) {
  if (!isObject(raw)) return null;
  const thread = isObject(raw.thread) ? raw.thread : null;
  // The API may return the thread as a populated object or as a plain id string.
  const threadRef = thread?.id || (typeof raw.thread === 'string' ? raw.thread : null) || raw.threadId;
  return {
    id: String(pick(raw, ['id', '_id']) || ''),
    type: typeof raw.type === 'string' ? raw.type : 'system',
    message: String(pick(raw, ['message']) || ''),
    read: Boolean(raw.read),
    createdAt: pick(raw, ['createdAt']) || null,
    threadId: threadRef ? String(threadRef) : null,
    threadTitle: thread?.title ? String(thread.title) : typeof raw.threadTitle === 'string' ? raw.threadTitle : '',
    threadSlug: thread?.boardSlug ? String(thread.boardSlug) : null,
  };
}

export function normalizePreferences(raw) {
  if (!isObject(raw)) return null;
  return {
    displayAlias: typeof raw.displayAlias === 'string' ? raw.displayAlias : '',
    showCrisisBar: raw.showCrisisBar !== false,
    contentWarningDefault: raw.contentWarningDefault === true,
    reduceMotion: raw.reduceMotion === true,
  };
}

const CRISIS_LEVELS = new Set(['none', 'low', 'elevated', 'high']);

/** Normalises POST /crisis/assess (frozen as `{ assessment: {...} }`). */
export function normalizeAssessment(data) {
  const assessment = asEntity(data, ['assessment']) || {};
  const level = CRISIS_LEVELS.has(assessment.level) ? assessment.level : 'none';
  return {
    level,
    showResources: Boolean(assessment.showResources),
    reasons: Array.isArray(assessment.reasons) ? assessment.reasons.filter((reason) => typeof reason === 'string') : [],
    score: toNumberOrNull(assessment.score),
  };
}

/** Non-blocking support payload attached to thread/reply creation responses. */
export function normalizeSupport(data) {
  if (!isObject(data) || !isObject(data.support)) return null;
  const support = data.support;
  const level = CRISIS_LEVELS.has(support.level) ? support.level : 'none';
  if (level !== 'elevated' && level !== 'high') return null;
  return { level, showResources: support.showResources !== false };
}

export function boardPath(board) {
  const slug = typeof board === 'string' ? board : board?.slug;
  return slug ? `/boards/${encodeURIComponent(slug)}` : '/community';
}

export function threadPath(thread) {
  return thread?.id ? `/threads/${encodeURIComponent(thread.id)}` : '/community';
}

export default {
  asEntity,
  asList,
  toNumberOrNull,
  toNumberOrZero,
  normalizeMeta,
  normalizeBoard,
  normalizeThread,
  normalizeReply,
  normalizeNotification,
  normalizePreferences,
  normalizeAssessment,
  normalizeSupport,
  boardPath,
  threadPath,
};
