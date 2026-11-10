'use strict';

/**
 * Session cookie helpers (docs/ARCHITECTURE.md §6.2, §12.2).
 *
 * Cookie contract:
 *  - `ay_at`  access JWT      httpOnly, path `/`,                TTL ACCESS_TOKEN_TTL_MIN
 *  - `ay_rt`  refresh token   httpOnly, path `<apiBasePath>/auth`, TTL SESSION_TTL_DAYS
 *  - `ay_csrf` CSRF token     readable, path `/`,                TTL SESSION_TTL_DAYS
 *
 * `sameSite: 'none'` always implies `secure: true` (browsers reject the combination
 * otherwise); it is only valid over HTTPS and is documented in docs/SECURITY.md.
 */
const env = require('../config/env');

const COOKIE_NAMES = Object.freeze({
  access: 'ay_at',
  refresh: 'ay_rt',
  csrf: 'ay_csrf',
});

const REFRESH_COOKIE_PATH = `${env.apiBasePath}/auth`;
const ACCESS_COOKIE_MAX_AGE_MS = env.accessTokenTtlMin * 60 * 1000;
const SESSION_COOKIE_MAX_AGE_MS = env.sessionTtlDays * 24 * 60 * 60 * 1000;

/**
 * Effective SameSite value, honouring the environment setting.
 * @returns {'lax'|'none'}
 */
function sameSite() {
  return env.cookieSameSite === 'none' ? 'none' : 'lax';
}

/**
 * Effective Secure flag. `SameSite=None` requires Secure by definition.
 * @returns {boolean}
 */
function secureFlag() {
  return Boolean(env.cookieSecure) || sameSite() === 'none';
}

/**
 * Build the shared attribute set for a cookie.
 * @param {{path:string, httpOnly:boolean, maxAge:number}} options
 * @returns {import('express').CookieOptions}
 */
function cookieOptions({ path, httpOnly, maxAge }) {
  const options = {
    httpOnly,
    secure: secureFlag(),
    sameSite: sameSite(),
    path,
    maxAge,
  };
  if (env.cookieDomain) options.domain = env.cookieDomain;
  return options;
}

/**
 * Set the access, refresh and CSRF cookies for a newly created/renewed session.
 * @param {import('express').Response} res
 * @param {{accessToken:string, refreshToken:string, csrfToken:string, maxAgeMs?:number}} tokens
 * @returns {void}
 */
function setSessionCookies(res, { accessToken, refreshToken, csrfToken, maxAgeMs } = {}) {
  if (!res || typeof res.cookie !== 'function') {
    throw new TypeError('setSessionCookies requires an Express response object');
  }
  if (typeof accessToken !== 'string' || !accessToken) {
    throw new TypeError('setSessionCookies requires accessToken');
  }
  if (typeof refreshToken !== 'string' || !refreshToken) {
    throw new TypeError('setSessionCookies requires refreshToken');
  }
  if (typeof csrfToken !== 'string' || !csrfToken) {
    throw new TypeError('setSessionCookies requires csrfToken');
  }

  const sessionMaxAge = Number.isFinite(maxAgeMs) && maxAgeMs > 0 ? maxAgeMs : SESSION_COOKIE_MAX_AGE_MS;

  res.cookie(
    COOKIE_NAMES.access,
    accessToken,
    cookieOptions({ path: '/', httpOnly: true, maxAge: ACCESS_COOKIE_MAX_AGE_MS })
  );
  // Refresh cookie is scoped to the auth endpoints only: it is never sent to
  // forum/chat/crisis routes, shrinking its exposure surface.
  res.cookie(
    COOKIE_NAMES.refresh,
    refreshToken,
    cookieOptions({ path: REFRESH_COOKIE_PATH, httpOnly: true, maxAge: sessionMaxAge })
  );
  res.cookie(
    COOKIE_NAMES.csrf,
    csrfToken,
    cookieOptions({ path: '/', httpOnly: false, maxAge: sessionMaxAge })
  );
}

/**
 * Set (or rotate) only the readable CSRF cookie.
 * @param {import('express').Response} res
 * @param {string} token signed CSRF token (`<raw>.<hmac>`)
 * @param {number} [maxAgeMs] defaults to SESSION_TTL_DAYS
 * @returns {void}
 */
function setCsrfCookie(res, token, maxAgeMs) {
  if (!res || typeof res.cookie !== 'function') {
    throw new TypeError('setCsrfCookie requires an Express response object');
  }
  if (typeof token !== 'string' || !token) {
    throw new TypeError('setCsrfCookie requires a token');
  }
  const sessionMaxAge = Number.isFinite(maxAgeMs) && maxAgeMs > 0 ? maxAgeMs : SESSION_COOKIE_MAX_AGE_MS;

  res.cookie(
    COOKIE_NAMES.csrf,
    token,
    cookieOptions({ path: '/', httpOnly: false, maxAge: sessionMaxAge })
  );
}

/**
 * Clear all three session cookies (logout / invalid session). Paths and flags must
 * match the values used when setting them or the browser keeps the original cookie.
 * @param {import('express').Response} res
 * @returns {void}
 */
function clearSessionCookies(res) {
  if (!res || typeof res.clearCookie !== 'function') {
    throw new TypeError('clearSessionCookies requires an Express response object');
  }

  const shared = {
    secure: secureFlag(),
    sameSite: sameSite(),
  };
  if (env.cookieDomain) shared.domain = env.cookieDomain;

  res.clearCookie(COOKIE_NAMES.access, { ...shared, path: '/', httpOnly: true });
  res.clearCookie(COOKIE_NAMES.refresh, { ...shared, path: REFRESH_COOKIE_PATH, httpOnly: true });
  res.clearCookie(COOKIE_NAMES.csrf, { ...shared, path: '/', httpOnly: false });
}

module.exports = {
  COOKIE_NAMES,
  setSessionCookies,
  setCsrfCookie,
  clearSessionCookies,
  // Exported for tests and for callers that need the same windows (additive).
  REFRESH_COOKIE_PATH,
  ACCESS_COOKIE_MAX_AGE_MS,
  SESSION_COOKIE_MAX_AGE_MS,
};
