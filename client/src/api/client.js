/**
 * The single API service layer.
 *
 * Contract (docs/ARCHITECTURE.md §12.6):
 *  - always sends cookies (`credentials: 'include'`);
 *  - sends the double-submit CSRF header on state-changing requests;
 *  - unwraps the `{success, message, data, meta}` envelope;
 *  - throws a typed ApiError carrying `status`, `code`, `details`, `requestId`;
 *  - transparently (re)establishes an anonymous session on 401 and retries once.
 */

const RAW_BASE = import.meta.env.VITE_API_BASE_URL || '/api/v1';
export const API_BASE_URL = RAW_BASE.replace(/\/$/, '');

export class ApiError extends Error {
  constructor({ status, code, message, details, requestId }) {
    super(message || 'Request failed');
    this.name = 'ApiError';
    this.status = status;
    this.code = code || 'INTERNAL_ERROR';
    this.details = details;
    this.requestId = requestId;
    this.isNetworkError = status === 0;
  }
}

function readCookie(name) {
  if (typeof document === 'undefined') return undefined;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : undefined;
}

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

let bootstrapPromise = null;

async function bootstrapSession() {
  if (!bootstrapPromise) {
    bootstrapPromise = request('/auth/session', { method: 'POST', body: {}, skipAuthRetry: true })
      .catch(() => null)
      .finally(() => {
        bootstrapPromise = null;
      });
  }
  return bootstrapPromise;
}

function buildUrl(path, query) {
  const suffix = path.startsWith('/') ? path : `/${path}`;
  const url = new URL(`${API_BASE_URL}${suffix}`, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') return;
      if (Array.isArray(value)) {
        value.filter(Boolean).forEach((entry) => url.searchParams.append(key, entry));
      } else {
        url.searchParams.set(key, String(value));
      }
    });
  }
  // Relative URLs keep the dev proxy and same-origin deployments working.
  return `${url.pathname}${url.search}`;
}

async function request(path, options = {}) {
  const {
    method = 'GET',
    body,
    query,
    signal,
    headers = {},
    skipAuthRetry = false,
    timeoutMs = 30_000,
  } = options;

  const timeoutController = new AbortController();
  const timeout = setTimeout(() => timeoutController.abort(new Error('timeout')), timeoutMs);
  const onAbort = () => timeoutController.abort(new Error('aborted'));
  if (signal) {
    if (signal.aborted) onAbort();
    else signal.addEventListener('abort', onAbort, { once: true });
  }

  const finalHeaders = { Accept: 'application/json', ...headers };
  if (body !== undefined) finalHeaders['Content-Type'] = 'application/json';
  if (MUTATING.has(method)) {
    const csrfToken = readCookie('ay_csrf');
    if (csrfToken) finalHeaders['x-csrf-token'] = csrfToken;
  }

  let response;
  try {
    response = await fetch(buildUrl(path, query), {
      method,
      credentials: 'include',
      headers: finalHeaders,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: timeoutController.signal,
    });
  } catch (error) {
    clearTimeout(timeout);
    throw new ApiError({
      status: 0,
      code: 'NETWORK_ERROR',
      message:
        error?.name === 'AbortError'
          ? 'The request took too long. Please check your connection and try again.'
          : 'We could not reach AdiYogi. Please check your connection and try again.',
    });
  } finally {
    clearTimeout(timeout);
    if (signal) signal.removeEventListener('abort', onAbort);
  }

  if (response.status === 204) return { data: null, meta: null };

  let payload = null;
  const text = await response.text();
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    const error = new ApiError({
      status: response.status,
      code: payload?.error?.code,
      message: payload?.message,
      details: payload?.error?.details,
      requestId: payload?.requestId || response.headers.get('x-request-id'),
    });

    // Expired/absent session: establish one and retry exactly once.
    if (response.status === 401 && !skipAuthRetry && !path.startsWith('/auth/')) {
      const session = await bootstrapSession();
      if (session) return request(path, { ...options, skipAuthRetry: true });
    }
    throw error;
  }

  return { data: payload?.data ?? null, meta: payload?.meta ?? null, message: payload?.message };
}

/** Public API used by `endpoints.js` and tests. */
export const api = {
  get: (path, options = {}) => request(path, { ...options, method: 'GET' }),
  post: (path, body, options = {}) => request(path, { ...options, method: 'POST', body }),
  patch: (path, body, options = {}) => request(path, { ...options, method: 'PATCH', body }),
  put: (path, body, options = {}) => request(path, { ...options, method: 'PUT', body }),
  delete: (path, body, options = {}) => request(path, { ...options, method: 'DELETE', body }),
  bootstrapSession,
};

export default api;
