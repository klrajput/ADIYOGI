/** Small, dependency-free formatting helpers used across the UI. */

export function timeAgo(input) {
  if (!input) return '';
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return '';
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 45) return 'just now';
  if (seconds < 90) return 'a minute ago';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatDate(date);
}

export function formatDate(input, options = {}) {
  if (!input) return '';
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...options,
  });
}

export function formatDateTime(input) {
  if (!input) return '';
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function pluralize(count, singular, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function truncate(text, max = 160) {
  if (!text) return '';
  const value = String(text).trim();
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1).trimEnd()}…`;
}

/** Compact count for counters: 12 → "12", 12500 → "12.5k". Null stays null. */
export function formatCount(count) {
  if (count === null || count === undefined || count === '') return null;
  const value = Number(count);
  if (!Number.isFinite(value)) return null;
  if (value < 1000) return value.toLocaleString();
  if (value < 1000000) {
    const thousands = value / 1000;
    return `${thousands >= 100 ? Math.round(thousands) : Math.round(thousands * 10) / 10}k`;
  }
  const millions = value / 1000000;
  return `${Math.round(millions * 10) / 10}m`;
}

/**
 * Honest count phrase used across the forum:
 *   null → null (render nothing — never invent a zero)
 *   0    → "No threads yet" (or the supplied zeroLabel)
 *   1    → "1 thread"
 *   12   → "12 threads"
 */
export function countPhrase(count, singular, plural = `${singular}s`, zeroLabel) {
  const value = Number(count);
  if (count === null || count === undefined || !Number.isFinite(value)) return null;
  if (value === 0) return zeroLabel || `No ${plural}`;
  return pluralize(value, singular, plural);
}

/**
 * Turns a board slug into a readable label when the API only supplies the slug
 * ("grief-and-loss" → "Grief and loss"). Never invents data — it is derived
 * from the slug that the server returned.
 */
export function humanizeSlug(slug = '') {
  if (!slug) return '';
  const words = String(slug).replace(/[-_]+/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function initials(label = '') {
  return label
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');
}

export function classNames(...values) {
  return values.filter(Boolean).join(' ');
}

/** Region options offered in the crisis UI (server resolves the content). */
export const CRISIS_REGIONS = [
  { code: 'US', label: 'United States' },
  { code: 'IN', label: 'India' },
  { code: 'GB', label: 'United Kingdom' },
  { code: 'CA', label: 'Canada' },
  { code: 'AU', label: 'Australia' },
];
