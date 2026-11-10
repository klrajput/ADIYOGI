/**
 * Shared product copy and enumerations.
 *
 * Everything a screen needs to be honest about the product lives here so the
 * disclaimer, reporting reasons and moderation wording stay consistent.
 */

export const APP_NAME = 'AdiYogi';

/** Shown wherever the product is described — always plain, never clinical. */
export const PEER_SUPPORT_DISCLAIMER =
  'AdiYogi is peer support. It is not therapy, diagnosis, or emergency care, and it cannot replace a qualified professional.';

export const AI_DISCLOSURE =
  'The AI companion is a computer program, not a therapist or a doctor. It cannot diagnose you, and it is not monitored by a clinician. It can make mistakes or miss distress — if you need real support now, please use the crisis resources.';

export const PRIVACY_SUMMARY = [
  'No real name or email is needed to read, post, or use the AI companion.',
  'Your posts are public to other people using AdiYogi, under an anonymous alias.',
  'Only a one-way hash of your IP address is stored for abuse prevention — never the raw address.',
  'AI chat messages are removed automatically after the retention window configured on the server.',
  'There is no third-party analytics or advertising script in the app.',
];

export const BOARD_SUPPORT_LEVELS = {
  general: { label: 'General support', tone: 'neutral' },
  peer: { label: 'Peer support', tone: 'primary' },
  crisis: { label: 'Higher-support space', tone: 'crisis' },
};

export const THREAD_SORTS = [
  { value: 'recent', label: 'Recently active' },
  { value: 'new', label: 'Newest first' },
  { value: 'replies', label: 'Most replies' },
];

export const DEFAULT_THREAD_SORT = 'recent';

/** Report reasons are the enum accepted by POST /reports (docs/ARCHITECTURE.md §4.3). */
export const REPORT_REASONS = [
  { value: 'spam', label: 'Spam or advertising', hint: 'Repetitive promotion, links, or bot-like posting' },
  { value: 'harassment', label: 'Harassment or hate', hint: 'Attacks, threats, or degrading language' },
  { value: 'self_harm_risk', label: 'Someone may be at risk', hint: 'A post that suggests someone is in danger right now' },
  { value: 'graphic', label: 'Graphic or distressing content', hint: 'Descriptions that need a stronger content warning' },
  { value: 'medical_misinformation', label: 'Medical misinformation', hint: 'Unsafe advice presented as treatment' },
  { value: 'other', label: 'Something else', hint: 'Explain it in the details below' },
];

export const NOTIFICATION_TYPE_LABELS = {
  thread_reply: 'New reply',
  moderation: 'Moderation',
  system: 'AdiYogi',
};

export const NOTIFICATION_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'unread', label: 'Unread' },
];

/** The body length below which a crisis assessment is unnecessary noise. */
export const CRISIS_ASSESS_MIN_LENGTH = 20;

/** Thread validation mirrors the server contract (title 3–160, body 20–5000). */
export const THREAD_LIMITS = {
  titleMin: 3,
  titleMax: 160,
  bodyMin: 20,
  bodyMax: 5000,
  tagsMax: 6,
  tagMaxLength: 24,
};

/** Reply body limit from the data contract. */
export const REPLY_LIMITS = { min: 2, max: 3000 };

export const CONTENT_WARNING_LABEL = 'This post discusses potentially distressing material.';

export const AVATAR_CHAR_LIMIT = 2;
