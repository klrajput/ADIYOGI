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

/** Absolute API used only if a same-origin proxy is not available on a deployed host. */
const FALLBACK_API_BASE = 'https://adiyogi-api-0z0y.onrender.com/api/v1';

/** Session-scoped override chosen when the same-origin proxy fails. */
let apiBaseOverride = null;

export const API_BASE_URL = RAW_BASE.replace(/\/$/, '');

function resolveBase() {
  return apiBaseOverride || API_BASE_URL;
}

function isLocalhost() {
  if (typeof window === 'undefined') return true;
  return ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname);
}

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

/**
 * CSRF token cache.
 *
 * The canonical delivery is the readable `ay_csrf` cookie (double-submit). When the web
 * app and the API are on different registrable domains (e.g. vercel.app + onrender.com)
 * the browser will not expose the API's cookie to JS, so the API also returns the signed
 * token in the body of every session-mutating auth response. Caching it here keeps CSRF
 * working for both same-origin and cross-origin deployments.
 */
let csrfTokenCache = null;

function rememberCsrfToken(payload) {
  const token = payload && payload.data && payload.data.csrfToken;
  if (typeof token === 'string' && token.length > 0) csrfTokenCache = token;
}

function currentCsrfToken() {
  return readCookie('ay_csrf') || csrfTokenCache || null;
}

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

let bootstrapPromise = null;

async function bootstrapSession() {
  if (!bootstrapPromise) {
    bootstrapPromise = (async () => {
      // Cross-origin deployments cannot read the API's `ay_csrf` cookie from JS. When a
      // long-lived refresh cookie already exists (page reload), POST /auth/session is
      // CSRF-gated — so fetch a token first. GET is never CSRF-gated and its body carries
      // the signed token through CORS-with-credentials.
      if (!currentCsrfToken()) {
        try {
          await request('/auth/csrf', { method: 'GET', skipAuthRetry: true, timeoutMs: 60_000 });
        } catch {
          /* fall through: same-origin deployments already have a readable cookie */
        }
      }
      try {
        return await request('/auth/session', {
          method: 'POST',
          body: {},
          skipAuthRetry: true,
          timeoutMs: 60_000,
        });
      } catch (firstError) {
        // A deployed host without a working /api proxy: retry against the absolute API once.
        if (!apiBaseOverride && API_BASE_URL.startsWith('/') && !isLocalhost()) {
          apiBaseOverride = FALLBACK_API_BASE;
          try {
            clearCsrfTokenCache();
            return await request('/auth/session', {
              method: 'POST',
              body: {},
              skipAuthRetry: true,
              timeoutMs: 60_000,
            });
          } catch {
            apiBaseOverride = null;
          }
        }
        if (firstError) return null;
        return null;
      }
    })().finally(() => {
      bootstrapPromise = null;
    });
  }
  return bootstrapPromise;
}

function buildUrl(path, query) {
  const suffix = path.startsWith('/') ? path : `/${path}`;
  const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
  const base = new URL(resolveBase(), origin);
  const baseHref = base.href.endsWith('/') ? base.href : `${base.href}/`;
  // Resolve against the base (not the origin) so an absolute VITE_API_BASE_URL such as
  // https://api.example.com/api/v1 is honoured; a relative base keeps dev-proxy/same-origin
  // requests relative.
  const url = new URL(suffix.replace(/^\//, ''), baseHref);
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
  const sameOrigin = url.origin === origin;
  return sameOrigin ? `${url.pathname}${url.search}` : url.toString();
}

async function request(path, options = {}) {
  const {
    method = 'GET',
    body,
    query,
    signal,
    headers = {},
    skipAuthRetry = false,
    timeoutMs = 45_000,
    retried = false,
    csrfRetried = false,
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
    const csrfToken = currentCsrfToken();
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
    // Contract §12.6: idempotent GETs get exactly one retry on a transport failure.
    if (method === 'GET' && !retried && !signal?.aborted) {
      return request(path, { ...options, retried: true });
    }
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

  rememberCsrfToken(payload);

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

    // Rotated/rejected CSRF token (e.g. the server rotated the cookie mid-session):
    // fetch a fresh token, then retry this write exactly once.
    if (error.code === 'CSRF_INVALID' && !csrfRetried && !path.startsWith('/auth/')) {
      try {
        clearCsrfTokenCache();
        await request('/auth/csrf', { method: 'GET', skipAuthRetry: true, timeoutMs: 60_000 });
        return request(path, { ...options, skipAuthRetry: true, csrfRetried: true });
      } catch {
        /* fall through to the original error */
      }
    }
    throw error;
  }

  return { data: payload?.data ?? null, meta: payload?.meta ?? null, message: payload?.message };
}

/** Public API used by `endpoints.js` and tests. */
export function clearCsrfTokenCache() {
  csrfTokenCache = null;
}

export const api = {
  get: (path, options = {}) => request(path, { ...options, method: 'GET' }),
  post: (path, body, options = {}) => request(path, { ...options, method: 'POST', body }),
  patch: (path, body, options = {}) => request(path, { ...options, method: 'PATCH', body }),
  put: (path, body, options = {}) => request(path, { ...options, method: 'PUT', body }),
  delete: (path, body, options = {}) => request(path, { ...options, method: 'DELETE', body }),
  bootstrapSession,
};

export default api;
