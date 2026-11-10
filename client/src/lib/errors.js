/**
 * User-facing error copy.
 *
 * Never renders a stack trace, a raw server message for unexpected failures, or
 * a request id unless it is genuinely useful for support. Maps the frozen error
 * codes from docs/ARCHITECTURE.md §4.2 to calm, actionable sentences.
 */

const CODE_MESSAGES = {
  NETWORK_ERROR: 'We could not reach AdiYogi. Please check your connection and try again.',
  VALIDATION_ERROR: 'Please check the highlighted fields and try again.',
  UNAUTHENTICATED: 'Your session has expired. Refreshing usually fixes this — please try again.',
  CSRF_INVALID: 'Your session needs a refresh before this can be saved. Please reload the page and try again.',
  FORBIDDEN: 'You do not have permission to do that.',
  NOT_FOUND: 'We could not find that here. It may have been removed.',
  CONFLICT: 'That action was already taken.',
  PAYLOAD_TOO_LARGE: 'That is too long to save. Please shorten it and try again.',
  RATE_LIMITED: 'You are doing that a little too quickly. Please wait a moment and try again.',
  CONTENT_BLOCKED: 'This content could not be published because it breaks the community guidelines.',
  AI_UNAVAILABLE: 'The AI companion is unavailable right now. No substitute answer has been generated.',
  SERVICE_UNAVAILABLE: 'AdiYogi is temporarily unavailable. Please try again in a few moments.',
  INTERNAL_ERROR: 'Something went wrong on our side. Please try again.',
  INVALID_CREDENTIALS: 'That email and password do not match an account.',
  ACCOUNT_LOCKED: 'This account is temporarily locked after too many attempts. Please try again later.',
  ACCOUNT_SUSPENDED: 'This account is suspended. Please contact the moderation team if you think this is a mistake.',
};

function retryAfterSeconds(error) {
  const details = error?.details;
  if (!details) return null;
  const value = details.retryAfter ?? details.retryAfterSeconds;
  const seconds = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(seconds) && seconds > 0 ? Math.ceil(seconds) : null;
}

/** A safe, human message for any thrown value. */
export function getErrorMessage(error, fallback = 'Something went wrong. Please try again.') {
  if (!error) return fallback;
  const code = typeof error.code === 'string' ? error.code : '';
  const wait = retryAfterSeconds(error);
  if (code === 'RATE_LIMITED' && wait) {
    return `You are doing that a little too quickly. Please try again in ${wait} second${wait === 1 ? '' : 's'}.`;
  }
  if (code === 'ACCOUNT_LOCKED' && wait) {
    return `This account is temporarily locked after too many attempts. Please try again in ${Math.ceil(wait / 60)} minute${
      Math.ceil(wait / 60) === 1 ? '' : 's'
    }.`;
  }
  if (code && CODE_MESSAGES[code]) return CODE_MESSAGES[code];

  // Non-ok status codes without a known code: map the status class.
  if (error.status === 0 || error.isNetworkError) return CODE_MESSAGES.NETWORK_ERROR;
  if (error.status === 401) return CODE_MESSAGES.UNAUTHENTICATED;
  if (error.status === 403) return CODE_MESSAGES.FORBIDDEN;
  if (error.status === 404) return CODE_MESSAGES.NOT_FOUND;
  if (error.status === 429) return CODE_MESSAGES.RATE_LIMITED;
  if (error.status >= 500) return CODE_MESSAGES.SERVICE_UNAVAILABLE;

  // Validation messages from the server are written for humans; use them when
  // they are a reasonable, short sentence.
  const message = typeof error.message === 'string' ? error.message.trim() : '';
  if (message && message.length <= 240) return message;
  return fallback;
}

/**
 * Maps `error.details` (`[{ path: 'body.title', message: '…' }]`) to a
 * `{ title: '…', body: '…' }` object so forms can highlight the field.
 */
export function getFieldErrors(error) {
  const details = error?.details;
  if (!Array.isArray(details)) return {};
  const fields = {};
  details.forEach((detail) => {
    if (!detail || typeof detail !== 'object') return;
    const rawPath = typeof detail.path === 'string' ? detail.path : '';
    const path = rawPath.split('.').filter(Boolean);
    const field = path[path.length - 1];
    const message = typeof detail.message === 'string' ? detail.message : '';
    if (field && message && !fields[field]) fields[field] = message;
  });
  return fields;
}

export function isNotFound(error) {
  return error?.status === 404 || error?.code === 'NOT_FOUND';
}

export function isRateLimited(error) {
  return error?.status === 429 || error?.code === 'RATE_LIMITED';
}

export function isUnauthenticated(error) {
  return error?.status === 401 || error?.code === 'UNAUTHENTICATED';
}

export default { getErrorMessage, getFieldErrors, isNotFound, isRateLimited, isUnauthenticated };
