/**
 * Normalisation + link helpers for the crisis resources API.
 *
 * The frontend never hard-codes regional helplines: `GET /crisis/resources` is
 * the only source of phone numbers (docs/ARCHITECTURE.md §8). The constants below
 * are deliberately location-neutral and are only used to keep the page useful
 * when that request fails: a generic emergency-services pointer and the
 * international directory `findahelpline.com`.
 */

export const FIND_A_HELPLINE = {
  name: 'Find a Helpline',
  description: 'A free directory of verified mental-health helplines in over 130 countries.',
  contact: 'findahelpline.com',
  type: 'web',
  url: 'https://findahelpline.com',
  available: 'Directory is always available; helpline hours vary by country.',
};

export const EMERGENCY_FALLBACK = {
  name: 'Emergency services',
  description:
    'If you or someone else is in immediate danger, call your local emergency number now.',
  contact: 'your local emergency number',
  type: 'phone',
  available: 'Available 24/7 in most countries',
};

const PHONE_TYPES = new Set(['phone', 'text']);

/** Keep only http(s) URLs so the UI can never render a javascript: target. */
export function safeHttpUrl(value) {
  if (!value || typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    if (url.protocol === 'https:' || url.protocol === 'http:') return url.toString();
  } catch {
    // Not an absolute URL — we never invent one.
  }
  return null;
}

function phoneDigits(value) {
  const digits = String(value || '').replace(/[^\d+]/g, '');
  return digits.replace(/\+/g, '').length >= 3 ? digits : null;
}

function normaliseEntry(entry, typeHint) {
  if (!entry) return null;
  if (typeof entry === 'string') {
    if (!entry.trim()) return null;
    return { name: entry.trim(), contact: '', type: typeHint || 'web', available: '', url: null, verifiedOn: '' };
  }
  if (typeof entry !== 'object') return null;
  const name = String(entry.name || entry.label || '').trim();
  if (!name) return null;
  const url = safeHttpUrl(entry.url);
  // The API's `international` entry is a directory link with no explicit type.
  const type = String(entry.type || (url ? 'web' : typeHint || 'phone'));
  return {
    name,
    contact: String(entry.contact || entry.number || '').trim(),
    type,
    available: String(entry.available || entry.hours || '').trim(),
    url,
    description: String(entry.description || entry.note || '').trim(),
    verifiedOn: String(entry.verifiedOn || entry.lastVerified || '').trim(),
  };
}

function normaliseList(value) {
  if (Array.isArray(value)) return value.map((entry) => normaliseEntry(entry)).filter(Boolean);
  if (value && typeof value === 'object') {
    return Object.values(value)
      .flatMap((entry) => (Array.isArray(entry) ? entry : [entry]))
      .map((entry) => normaliseEntry(entry))
      .filter(Boolean);
  }
  return [];
}

/**
 * Turn the API payload into a predictable shape. Tolerates a resources payload
 * nested under `resources` and tolerates missing sections — the page then shows
 * the international fallback instead of an error.
 */
export function normaliseCrisisResources(payload) {
  if (!payload || typeof payload !== 'object') return null;
  const source =
    payload.resources && typeof payload.resources === 'object' ? payload.resources : payload;
  if (!source || typeof source !== 'object') return null;

  const regional = normaliseList(source.local ?? source.locals ?? source.helplines).filter(
    (entry) => entry.name !== FIND_A_HELPLINE.name
  );
  const primary = normaliseEntry(source.primary);
  const text = normaliseEntry(source.text);
  const emergency = normaliseEntry(source.emergency);
  const international =
    normaliseEntry(source.international) || (source.international ? null : normaliseEntry(FIND_A_HELPLINE));

  return {
    region: String(source.region || source.country || '').toUpperCase() || null,
    primary,
    text,
    emergency,
    local: regional,
    international: international || normaliseEntry(FIND_A_HELPLINE),
    lastVerified: String(source.lastVerified || source.verifiedOn || '').trim(),
    disclaimer: String(source.disclaimer || '').trim(),
  };
}

/** tel:, sms: or https: target for a resource entry, or null when none applies. */
export function contactHref(entry) {
  if (!entry) return null;
  if (entry.type === 'phone') {
    const digits = phoneDigits(entry.contact);
    return digits ? `tel:${digits}` : entry.url;
  }
  if (entry.type === 'text') {
    const digits = phoneDigits(entry.contact);
    if (digits) return `sms:${digits}`;
    return entry.url;
  }
  return entry.url;
}

export function contactLabel(entry) {
  if (!entry) return '';
  if (entry.type === 'phone') return `Call ${entry.name}`;
  if (entry.type === 'text') return `Text ${entry.name}`;
  if (entry.type === 'chat') return `Open ${entry.name}`;
  return entry.name;
}

export function isPhoneEntry(entry) {
  return Boolean(entry) && PHONE_TYPES.has(entry.type);
}

/** Human-readable "last verified" label, printed honestly (never rounded up). */
export function formatVerified(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const month = raw.match(/^(\d{4})-(\d{2})$/);
  if (month) {
    const date = new Date(Number(month[1]), Number(month[2]) - 1, 1);
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
    }
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw;
  return parsed.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
}
