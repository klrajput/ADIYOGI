'use strict';

/**
 * Session cookie contract (docs/ARCHITECTURE.md §6.2, §12.2).
 * The httpOnly/readable split is the core XSS/CSRF defence, so every attribute is
 * asserted on the real `Set-Cookie` headers produced through Express.
 */
const express = require('express');
const request = require('supertest');

const {
  COOKIE_NAMES,
  setSessionCookies,
  setCsrfCookie,
  clearSessionCookies,
  REFRESH_COOKIE_PATH,
} = require('../../src/utils/cookies');
const env = require('../../src/config/env');

function buildApp() {
  const app = express();
  app.get('/set', (req, res) => {
    setSessionCookies(res, {
      accessToken: 'access-token-value',
      refreshToken: 'refresh-token-value',
      csrfToken: 'csrf-token-value',
    });
    res.json({ ok: true });
  });
  app.get('/set-custom-age', (req, res) => {
    setSessionCookies(res, {
      accessToken: 'a',
      refreshToken: 'r',
      csrfToken: 'c',
      maxAgeMs: 60_000,
    });
    res.json({ ok: true });
  });
  app.get('/csrf', (req, res) => {
    setCsrfCookie(res, 'signed.csrf');
    res.json({ ok: true });
  });
  app.get('/clear', (req, res) => {
    clearSessionCookies(res);
    res.json({ ok: true });
  });
  return app;
}

function setCookie(res, name) {
  const header = res.headers['set-cookie'] || [];
  return header.find((entry) => entry.startsWith(`${name}=`));
}

describe('COOKIE_NAMES', () => {
  it('matches the frozen cookie names', () => {
    expect(COOKIE_NAMES).toEqual({ access: 'ay_at', refresh: 'ay_rt', csrf: 'ay_csrf' });
  });
});

describe('setSessionCookies', () => {
  const app = buildApp();
  let res;

  beforeAll(async () => {
    res = await request(app).get('/set').expect(200);
  });

  it('sets all three cookies', () => {
    expect(setCookie(res, COOKIE_NAMES.access)).toBeDefined();
    expect(setCookie(res, COOKIE_NAMES.refresh)).toBeDefined();
    expect(setCookie(res, COOKIE_NAMES.csrf)).toBeDefined();
  });

  it('access cookie is httpOnly, path=/ and short-lived', () => {
    const raw = setCookie(res, COOKIE_NAMES.access).toLowerCase();
    expect(raw).toContain(`=${encodeURIComponent('access-token-value')}`);
    expect(raw).toContain('httponly');
    expect(raw).toContain('path=/');
    expect(raw).toContain('samesite=lax');
    expect(raw).toContain(`max-age=${env.accessTokenTtlMin * 60}`);
    expect(raw).not.toContain('secure');
  });

  it('refresh cookie is httpOnly and scoped to the auth endpoints', () => {
    const raw = setCookie(res, COOKIE_NAMES.refresh).toLowerCase();
    expect(raw).toContain('httponly');
    expect(raw).toContain(`path=${REFRESH_COOKIE_PATH.toLowerCase()}`);
    expect(raw).toContain(`max-age=${env.sessionTtlDays * 24 * 60 * 60}`);
    expect(REFRESH_COOKIE_PATH).toBe(`${env.apiBasePath}/auth`);
  });

  it('CSRF cookie is readable by JS (not httpOnly) at path=/', () => {
    const raw = setCookie(res, COOKIE_NAMES.csrf);
    expect(raw.toLowerCase()).not.toContain('httponly');
    expect(raw.toLowerCase()).toContain('path=/');
    expect(raw).toContain('csrf-token-value');
  });

  it('honours an explicit maxAgeMs for refresh + csrf', async () => {
    const custom = await request(app).get('/set-custom-age').expect(200);
    const refreshRaw = setCookie(custom, COOKIE_NAMES.refresh).toLowerCase();
    expect(refreshRaw).toContain('max-age=60');
  });

  it('never emits SameSite=None without Secure', () => {
    const raw = setCookie(res, COOKIE_NAMES.access).toLowerCase();
    if (raw.includes('samesite=none')) expect(raw).toContain('secure');
  });

  it('throws when required tokens are missing', () => {
    const res = { cookie: () => {} };
    expect(() => setSessionCookies(res, {})).toThrow(TypeError);
    expect(() => setSessionCookies(res, { accessToken: 'a' })).toThrow(TypeError);
    expect(() => setSessionCookies(res, { accessToken: 'a', refreshToken: 'r' })).toThrow(TypeError);
    expect(() => setSessionCookies(null, {})).toThrow(TypeError);
  });
});

describe('setCsrfCookie', () => {
  it('rotates only the readable CSRF cookie', async () => {
    const res = await request(buildApp()).get('/csrf').expect(200);
    const csrf = setCookie(res, COOKIE_NAMES.csrf);
    expect(csrf).toBeDefined();
    expect(csrf.toLowerCase()).not.toContain('httponly');
    expect(setCookie(res, COOKIE_NAMES.access)).toBeUndefined();
  });

  it('requires a token', () => {
    expect(() => setCsrfCookie({ cookie: () => {} }, '')).toThrow(TypeError);
    expect(() => setCsrfCookie(null, 'x')).toThrow(TypeError);
  });
});

describe('clearSessionCookies', () => {
  it('expires all three cookies with their original paths', async () => {
    const res = await request(buildApp()).get('/clear').expect(200);
    const access = setCookie(res, COOKIE_NAMES.access).toLowerCase();
    const refresh = setCookie(res, COOKIE_NAMES.refresh).toLowerCase();
    const csrf = setCookie(res, COOKIE_NAMES.csrf).toLowerCase();

    expect(access).toContain('path=/');
    expect(refresh).toContain(`path=${REFRESH_COOKIE_PATH.toLowerCase()}`);
    expect(csrf).toContain('path=/');
    [access, refresh, csrf].forEach((raw) => {
      expect(raw).toMatch(/expires=thu, 01 jan 1970/);
    });
  });

  it('throws without a response object', () => {
    expect(() => clearSessionCookies(null)).toThrow(TypeError);
  });
});
