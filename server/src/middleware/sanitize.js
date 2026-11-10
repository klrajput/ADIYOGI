'use strict';

/**
 * Plain-text enforcement helpers (docs/ARCHITECTURE.md §12.1).
 *
 * The API is JSON-only and the React client renders user text as text nodes (never
 * `dangerouslySetInnerHTML`), so the primary XSS defence is output encoding/client
 * rendering. These helpers are defence-in-depth for the storage layer: forum content
 * is stored as plain text, never markup.
 *
 * `containsBlockedTerms` is a deliberately tiny, conservative spam denylist. It does
 * NOT contain mental-health vocabulary: words like "suicide", "self-harm", "trauma",
 * "abuse", "depressed", "crypto" or "money" must never be blocked here — flagging a
 * crisis disclosure as spam is a direct user-harm failure. Content moderation of
 * harmful material is a separate, human-reviewed workflow (reports/moderation).
 */

/** C0/C1 control characters that are never valid in stored text. */
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g;

/**
 * Minimal, high-confidence spam/solicitation patterns. Anything ambiguous is left to
 * the moderation queue instead of being auto-blocked.
 * @type {RegExp[]}
 */
const SPAM_PATTERNS = Object.freeze([
  // Explicit commercial solicitation.
  /\b(?:buy|order|purchase)\s+(?:now|today|here)\b/i,
  /\bclick\s+(?:here|this\s+link)\s+to\s+(?:win|claim|earn|buy)\b/i,
  // Investment/crypto scams.
  /\b(?:free|double|triple)\s+(?:crypto|bitcoin|btc|eth|money|gift\s*cards?)\b/i,
  /\b(?:crypto|bitcoin|forex)\s+(?:giveaway|airdrop|signals?)\b/i,
  /\b(?:guaranteed|risk[- ]free)\s+(?:returns?|profits?|income)\b/i,
  // Off-platform funnel patterns.
  /\b(?:dm|message|contact)\s+me\s+on\s+(?:telegram|whatsapp)\b/i,
  /\b(?:work\s+from\s+home|make\s+money\s+fast|earn\s+\$?\d+\s+(?:per|a)\s+(?:day|week))\b/i,
]);

/** Same word repeated 6+ times in a row (classic flood/spam). */
const REPEATED_WORD = /(\b[\p{L}\p{N}'-]{3,}\b)(?:\s+\1){5,}/iu;

const MAX_LINK_COUNT = 4;

/**
 * Remove markup/tags and control characters, returning plain text.
 * Control characters are replaced with spaces; newlines/tabs are preserved so
 * multi-paragraph bodies keep their structure (use normalizeText to flatten).
 * @param {string|undefined|null} text
 * @returns {string}
 */
function stripHtml(text) {
  if (typeof text !== 'string' || text.length === 0) return '';

  let value = text;
  // Repeated passes handle malformed/nested fragments such as `<scr<script>ipt>`.
  for (let pass = 0; pass < 3; pass += 1) {
    const next = value.replace(/<[^>]*>/g, ' ');
    if (next === value) break;
    value = next;
  }

  // No angle brackets may survive in stored plain text.
  value = value.replace(/[<>]/g, ' ');
  return value.replace(CONTROL_CHARS, ' ');
}

/**
 * Strip markup/control characters, normalise Unicode and collapse all whitespace
 * runs into single spaces. Intended for titles, aliases, tags and short fields —
 * do NOT use on multi-paragraph bodies where line breaks are meaningful.
 * @param {string|undefined|null} text
 * @returns {string}
 */
function normalizeText(text) {
  if (typeof text !== 'string' || text.length === 0) return '';
  const plain = stripHtml(text).normalize('NFC');
  return plain.replace(/\s+/g, ' ').trim();
}

/**
 * Count URL-ish tokens in normalised text.
 * @param {string} text
 * @returns {number}
 */
function countLinks(text) {
  const matches = text.match(/(?:https?:\/\/|www\.)/gi);
  return matches ? matches.length : 0;
}

/**
 * Conservative spam check. Returns true only for high-confidence spam patterns;
 * false negatives are intentional (they reach the human moderation queue instead).
 * @param {string|undefined|null} text
 * @returns {boolean} true when the text should be rejected as spam
 */
function containsBlockedTerms(text) {
  if (typeof text !== 'string' || text.trim().length === 0) return false;

  const value = normalizeText(text);
  if (!value) return false;

  if (countLinks(value) >= MAX_LINK_COUNT) return true;
  if (REPEATED_WORD.test(value)) return true;

  return SPAM_PATTERNS.some((pattern) => pattern.test(value));
}

module.exports = {
  stripHtml,
  normalizeText,
  containsBlockedTerms,
  // Additive export so validators/tests can inspect the policy without duplicating it.
  SPAM_PATTERNS,
};
