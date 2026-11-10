/** Shared helpers for the moderation surfaces. */

export function formatReason(reason) {
  if (!reason) return 'No reason recorded';
  return String(reason)
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^./, (character) => character.toUpperCase());
}

export function threadIdFor(targetType, targetId, targetThread) {
  if (targetType === 'thread') return targetId || null;
  if (typeof targetThread === 'string') return targetThread;
  if (targetThread && typeof targetThread === 'object') return targetThread.id || null;
  return null;
}

export const STATUS_TONES = {
  open: 'accent',
  reviewing: 'primary',
  resolved: 'primary',
  dismissed: 'neutral',
  hidden: 'crisis',
  removed: 'crisis',
  deleted: 'crisis',
};

export function statusLabel(status) {
  return formatReason(status);
}

export const ACTION_LABELS = {
  hide: 'Hid content',
  unhide: 'Unhid content',
  delete: 'Deleted content',
  pin: 'Pinned thread',
  unpin: 'Unpinned thread',
  lock: 'Locked thread',
  unlock: 'Unlocked thread',
};

export function actionLabel(action) {
  return ACTION_LABELS[action] || formatReason(action);
}
