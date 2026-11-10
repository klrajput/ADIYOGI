/**
 * The ONLY place in the client that touches localStorage.
 *
 * It stores exactly one value — the crisis region code (e.g. "IN") — so the
 * crisis page can remember a choice between visits. No personal data, no chat
 * content, no identifiers, no crisis events. Everything else comes from the API,
 * which keeps identity in httpOnly cookies.
 */
import { CRISIS_REGIONS } from '../../lib/format';

export const REGION_STORAGE_KEY = 'adiyogi.crisis.region';

/** Regions the API can resolve, plus an explicit opt-out for everyone else. */
export const REGION_OPTIONS = [
  ...CRISIS_REGIONS,
  { code: 'INTL', label: 'Somewhere else' },
];

const VALID_CODES = new Set(REGION_OPTIONS.map((option) => option.code));

/** The chosen region code, or null when the visitor has not chosen one yet. */
export function getSavedRegion() {
  try {
    const stored = window.localStorage.getItem(REGION_STORAGE_KEY);
    if (stored && VALID_CODES.has(stored)) return stored;
  } catch {
    // Storage can be unavailable (private mode, blocked cookies): not an error.
  }
  return null;
}

/** Persist a region code. Only ever a region code — nothing personal. */
export function saveRegion(code) {
  if (!VALID_CODES.has(code)) return;
  try {
    window.localStorage.setItem(REGION_STORAGE_KEY, code);
  } catch {
    // Losing the preference is harmless; the API fallback still applies.
  }
}

/**
 * The `country` query value for the resources endpoint. `INTL` is a real value
 * the API understands (international directory); `null` means "let the API infer
 * from Accept-Language".
 */
export function toApiCountry(code) {
  return code || undefined;
}

export function regionLabel(code) {
  const match = REGION_OPTIONS.find((option) => option.code === code);
  return match ? match.label : 'somewhere else';
}
