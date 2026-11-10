'use strict';

/**
 * Auth integration tests (docs/ARCHITECTURE.md §4.3, §6, §12).
 *
 * Real Express app, real middleware (CSRF, cookies, JWT, rate limits), real MongoDB
 * (mongodb-memory-server). Nothing is stubbed: these tests exercise the exact stack the
 * browser talks to.
 */
const jwt = require('jsonwebtoken');
const env = require('../../src/config/env');
const { COOKIE_NAMES } = require('../../src/utils/cookies');

const db = require('../helpers/db');
const app = require('../helpers/app');
const factories = require('../helpers/factories');
const { expectSuccess, expectError } = require('../helpers/envelopes');

jest.setTimeout(60000);

beforeAll(async () => {
  await db.startDatabase();
});

afterEach(async () => {
  await db.clearDatabase();
});

afterAll(async () => {
  await db.stopDatabase();
});

const IDENTITY_KEYS = [
  'id',
  'kind',
  'role',
  'alias',
  'createdAt',
  'isAnonymous',
  'preferences',
];

describe('POST /auth/session — anonymous bootstrap', () => {
  it('creates an anonymous identity with the frozen shape and preferences', async () => {
    const res = await app.client().post(app.apiPath('/auth/session')).send({});
    expectSuccess(res);
    expect(res.status).toBe(200);

    const { identity } = res.body.data;
    expect(Object.keys(identity).sort()).toEqual([...IDENTITY_KEYS].sort());
    expect(typeof identity.id).toBe('string');
    expect(identity.kind).toBe('anonymous');
    expect(identity.role).toBe('member');
    expect(identity.isAnonymous).toBe(true);
    expect(identity.alias).toMatch(/^Seeker /);
    expect(new Date(identity.createdAt).toISOString()).toBe(identity.createdAt);
    expect(identity.preferences).toEqual(
      expect.objectContaining({
        displayAlias: expect.any(String),
        showCrisisBar: expect.any(Boolean),
        contentWarningDefault: expect.any(Boolean),
        reduceMotion: expect.any(Boolean),
      })
    );
    expect(res.body.meta).toEqual({});
  });

  it('sets httpOnly session cookies with the documented flags (§6.2)', async () => {
    const { response } = await app.bootstrapAnonymous();

    const access = app.cookieFlags(response, COOKIE_NAMES.access);
    expect(access.httpOnly).toBe(true);
    expect(access.path).toBe('/');
    expect(access.sameSite).toBe('lax');
    expect(access.secure).toBe(false); // COOKIE_SECURE=false under NODE_ENV=test
    expect(access.maxAge).toBe(env.accessTokenTtlMin * 60);
    expect(access.value.split('.')).toHaveLength(3); // JWT

    const refresh = app.cookieFlags(response, COOKIE_NAMES.refresh);
    expect(refresh.httpOnly).toBe(true);
    expect(refresh.path).toBe(`${env.apiBasePath}/auth`);
    expect(refresh.value.length).toBeGreaterThanOrEqual(32);

    const csrf = app.cookieFlags(response, COOKIE_NAMES.csrf);
    expect(csrf.httpOnly).toBe(false); // readable so the SPA can echo it
    expect(csrf.path).toBe('/');
    expect(csrf.value).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
  });

  it('never returns tokens in the JSON body', async () => {
    const res = await app.client().post(app.apiPath('/auth/session')).send({});
    const body = JSON.stringify(res.body);
    expect(body).not.toContain('accessToken');
    expect(body).not.toContain('refreshToken');
    expect(body).not.toContain('tokenHash');
  });

  it('persists a session and preference row scoped to the session', async () => {
    const { response } = await app.bootstrapAnonymous();
    const { identity } = response.body.data;

    expect(await db.countDocuments('sessions')).toBe(1);
    expect(await db.countDocuments('userpreferences')).toBe(1);

    const [session] = await db.findRaw('sessions');
    expect(session.kind).toBe('anonymous');
    expect(String(session._id)).toBe(identity.id);
    expect(session.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(session.ipHash).not.toContain('127.0.0.1');

    const [preference] = await db.findRaw('userpreferences');
    expect(preference.ownerType).toBe('session');
    expect(String(preference.ownerId)).toBe(identity.id);
  });

  it('reuses the existing session when the refresh cookie is valid', async () => {
    const { agent, response } = await app.bootstrapAnonymous();
    const firstId = response.body.data.identity.id;

    // A session already exists, so the bootstrap path now requires CSRF (§6.3).
    const second = await agent.authPost('/auth/session');
    expectSuccess(second);
    expect(second.body.data.identity.id).toBe(firstId);
    expect(await db.countDocuments('sessions')).toBe(1);
  });
});

describe('GET /auth/me', () => {
  it('returns the caller identity and preferences', async () => {
    const agent = await app.anonymousAgent();
    const res = await agent.get(app.apiPath('/auth/me'));
    const { identity } = expectSuccess(res);
    expect(identity.kind).toBe('anonymous');
    expect(identity.preferences.displayAlias).toBeTruthy();
  });

  it('returns 401 UNAUTHENTICATED without a session', async () => {
    const res = await app.client().get(app.apiPath('/auth/me'));
    expectError(res, 401, 'UNAUTHENTICATED');
  });

  it('returns 401 (not 500) for a garbage access token', async () => {
    const res = await app
      .client()
      .get(app.apiPath('/auth/me'))
      .set('Cookie', `${COOKIE_NAMES.access}=not-a-jwt`);
    expectError(res, 401, 'UNAUTHENTICATED');
  });

  it('returns 401 (not 500) for an expired access token', async () => {
    const expired = jwt.sign({ kind: 'anonymous', role: 'member' }, env.jwtSecret, {
      algorithm: 'HS256',
      issuer: 'adiyogi',
      audience: 'adiyogi-web',
      subject: '507f1f77bcf86cd799439011',
      expiresIn: -60,
    });
    const res = await app
      .client()
      .get(app.apiPath('/auth/me'))
      .set('Cookie', `${COOKIE_NAMES.access}=${expired}`);
    expectError(res, 401, 'UNAUTHENTICATED');
  });

  it('returns 401 for a valid token whose session was revoked (logout)', async () => {
    const { agent, response } = await app.bootstrapAnonymous();
    const accessValue = app.cookieFlags(response, COOKIE_NAMES.access).value;

    await agent.authPost('/auth/logout').expect(204);

    const res = await app
      .client()
      .get(app.apiPath('/auth/me'))
      .set('Cookie', `${COOKIE_NAMES.access}=${accessValue}`);
    expectError(res, 401, 'UNAUTHENTICATED');
  });
});

describe('CSRF enforcement', () => {
  it('rejects a write with no CSRF header or cookie', async () => {
    const res = await app.client().post(app.apiPath('/auth/logout')).send({});
    expectError(res, 403, 'CSRF_INVALID');
  });

  it('rejects a write whose header does not match the cookie', async () => {
    const agent = await app.anonymousAgent();
    const res = await agent
      .post(app.apiPath('/auth/logout'))
      .set(app.CSRF_HEADER, 'forged-token')
      .send({});
    expectError(res, 403, 'CSRF_INVALID');
  });

  it('accepts a write with the matching double-submit token', async () => {
    const agent = await app.anonymousAgent();
    const res = await agent.authPost('/auth/logout');
    expect(res.status).toBe(204);
  });

  it('exempts session bootstrap only when no session exists', async () => {
    const fresh = await app.client().post(app.apiPath('/auth/session')).send({});
    expect(fresh.status).toBe(200);

    const withSession = await app
      .client()
      .post(app.apiPath('/auth/session'))
      .set('Cookie', `${COOKIE_NAMES.refresh}=some-refresh-cookie-value`)
      .send({});
    expectError(withSession, 403, 'CSRF_INVALID');
  });
});

describe('POST /auth/register', () => {
  it('creates a member account, signs it in and sets session cookies', async () => {
    const payload = factories.registerPayload();
    const res = await app.client().post(app.apiPath('/auth/register')).send(payload);

    expect(res.status).toBe(201);
    const { identity } = expectSuccess(res);
    expect(identity.kind).toBe('user');
    expect(identity.role).toBe('member');
    expect(identity.isAnonymous).toBe(false);
    expect(identity.alias).toBe(payload.displayName);
    expect(app.cookieFlags(res, COOKIE_NAMES.access).httpOnly).toBe(true);

    const user = await db.countDocuments('users');
    expect(user).toBe(1);
    const [stored] = await db.findRaw('users');
    expect(stored.email).toBe(payload.email); // normalised lowercase
    expect(stored.passwordHash).toMatch(/^\$2[aby]\$12\$/); // bcrypt cost 12, never plaintext
    expect(stored.passwordHash).not.toBe(payload.password);
  });

  it('rejects a weak password with VALIDATION_ERROR and a useful path', async () => {
    const res = await app
      .client()
      .post(app.apiPath('/auth/register'))
      .set('X-Forwarded-For', '203.0.113.10')
      .send({ email: factories.uniqueEmail('weak'), password: 'short' });
    const error = expectError(res, 400, 'VALIDATION_ERROR');
    expect(Array.isArray(error.details)).toBe(true);
    expect(error.details.some((detail) => String(detail.path).includes('password'))).toBe(true);
    expect(await db.countDocuments('users')).toBe(0);
  });

  it('rejects an invalid email', async () => {
    const res = await app
      .client()
      .post(app.apiPath('/auth/register'))
      .set('X-Forwarded-For', '203.0.113.10')
      .send({ email: 'not-an-email', password: factories.DEFAULT_PASSWORD });
    const error = expectError(res, 400, 'VALIDATION_ERROR');
    expect(error.details.some((detail) => String(detail.path).includes('email'))).toBe(true);
  });

  it('rejects a duplicate email with 409 CONFLICT', async () => {
    const payload = factories.registerPayload();
    await app
      .client()
      .post(app.apiPath('/auth/register'))
      .set('X-Forwarded-For', '203.0.113.11')
      .send(payload)
      .expect(201);

    const duplicate = await app
      .client()
      .post(app.apiPath('/auth/register'))
      .set('X-Forwarded-For', '203.0.113.11')
      .send(payload);
    expectError(duplicate, 409, 'CONFLICT');
    expect(await db.countDocuments('users')).toBe(1);
  });

  it('is exempt from CSRF only while sessionless', async () => {
    const payload = factories.registerPayload();
    const agent = await app.anonymousAgent();
    const res = await agent.post(app.apiPath('/auth/register')).send(payload);
    // The agent already carries a refresh cookie, so the bootstrap exemption does not apply.
    expectError(res, 403, 'CSRF_INVALID');
  });
});

describe('POST /auth/login', () => {
  it('signs in an existing account and returns the DB role', async () => {
    const created = await factories.createUserRecord({ role: 'moderator' });
    const res = await app
      .client()
      .post(app.apiPath('/auth/login'))
      .send({ email: created.email, password: created.password });

    const { identity } = expectSuccess(res);
    expect(identity.kind).toBe('user');
    expect(identity.role).toBe('moderator');
    expect(identity.id).toBe(String(created.user._id));

    const [stored] = await db.findRaw('users');
    expect(stored.lastLoginAt).toBeInstanceOf(Date);
    expect(stored.failedLoginAttempts).toBe(0);
  });

  it('rejects a wrong password with a generic 401 (no user enumeration)', async () => {
    const created = await factories.createUserRecord();
    const wrong = await app
      .client()
      .post(app.apiPath('/auth/login'))
      .send({ email: created.email, password: 'wrong-password-value' });
    const error = expectError(wrong, 401, 'UNAUTHENTICATED');
    expect(error).not.toHaveProperty('details');

    const message = wrong.body.message;
    expect(message).toBe('Email or password is incorrect');

    const [stored] = await db.findRaw('users');
    expect(stored.failedLoginAttempts).toBe(1);
  });

  it('rejects an unknown email with the same 401 message', async () => {
    const res = await app
      .client()
      .post(app.apiPath('/auth/login'))
      .set('X-Forwarded-For', '203.0.113.20')
      .send({ email: 'nobody@example.test', password: 'whatever-password' });
    expectError(res, 401, 'UNAUTHENTICATED');
    expect(res.body.message).toBe('Email or password is incorrect');
  });

  it('locks the account after 5 failed attempts and then rate-limits with 429', async () => {
    const created = await factories.createUserRecord();

    for (let attempt = 0; attempt < 5; attempt += 1) {
      // eslint-disable-next-line no-await-in-loop
      const res = await app
        .client()
        .post(app.apiPath('/auth/login'))
        .set('X-Forwarded-For', '203.0.113.30')
        .send({ email: created.email, password: 'definitely-wrong' });
      expectError(res, 401, 'UNAUTHENTICATED');
    }

    const [stored] = await db.findRaw('users');
    expect(stored.lockedUntil).toBeInstanceOf(Date);
    expect(stored.failedLoginAttempts).toBe(5);

    // Even the correct password is refused while locked.
    const locked = await app
      .client()
      .post(app.apiPath('/auth/login'))
      .set('X-Forwarded-For', '203.0.113.30')
      .send({ email: created.email, password: created.password });
    const error = expectError(locked, 429, 'RATE_LIMITED');
    expect(typeof error.details.retryAfterSeconds).toBe('number');
    expect(error.details.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('rejects a malformed login body', async () => {
    const res = await app
      .client()
      .post(app.apiPath('/auth/login'))
      .set('X-Forwarded-For', '203.0.113.21')
      .send({ email: 'x@y.z' });
    expectError(res, 400, 'VALIDATION_ERROR');
  });
});

describe('POST /auth/logout', () => {
  it('revokes the session server-side and clears cookies', async () => {
    const { agent } = await app.bootstrapAnonymous();
    expect(await db.countDocuments('sessions')).toBe(1);

    const res = await agent.authPost('/auth/logout');
    expect(res.status).toBe(204);

    const [session] = await db.findRaw('sessions');
    expect(session.revokedAt).toBeInstanceOf(Date);

    // The browser jar dropped its cookies, so an unauthenticated call is now rejected.
    const after = await agent.get(app.apiPath('/auth/me'));
    expectError(after, 401, 'UNAUTHENTICATED');
  });
});

describe('POST /auth/refresh — rotation', () => {
  it('rotates the refresh token in place and invalidates the old token', async () => {
    const { agent, response } = await app.bootstrapAnonymous();
    const oldRefresh = app.cookieFlags(response, COOKIE_NAMES.refresh).value;
    const oldCsrf = app.cookieFlags(response, COOKIE_NAMES.csrf).value;
    const [before] = await db.findRaw('sessions');

    const refreshed = await agent.authPost('/auth/refresh');
    const { identity } = expectSuccess(refreshed);

    // Same session identity, new refresh token + new CSRF token.
    expect(identity.id).toBe(response.body.data.identity.id);
    const newRefresh = app.cookieFlags(refreshed, COOKIE_NAMES.refresh).value;
    const newCsrf = app.cookieFlags(refreshed, COOKIE_NAMES.csrf).value;
    expect(newRefresh).not.toBe(oldRefresh);
    expect(newCsrf).not.toBe(oldCsrf);

    const sessions = await db.findRaw('sessions');
    expect(sessions).toHaveLength(1);
    expect(sessions[0].tokenHash).not.toBe(before.tokenHash); // stored hash rotated
    expect(sessions[0].revokedAt).toBeFalsy();

    // Replaying the OLD refresh token must fail: its hash was rotated away.
    const replay = await app
      .client()
      .post(app.apiPath('/auth/refresh'))
      .set('Cookie', `${COOKIE_NAMES.refresh}=${oldRefresh}; ${COOKIE_NAMES.csrf}=${oldCsrf}`)
      .set(app.CSRF_HEADER, oldCsrf);
    expectError(replay, 401, 'UNAUTHENTICATED');

    // The rotated token still works.
    const second = await app
      .client()
      .post(app.apiPath('/auth/refresh'))
      .set('Cookie', `${COOKIE_NAMES.refresh}=${newRefresh}; ${COOKIE_NAMES.csrf}=${newCsrf}`)
      .set(app.CSRF_HEADER, newCsrf);
    expectSuccess(second);
  });

  it('rejects a refresh with no refresh cookie', async () => {
    // A valid CSRF pair but no session: the 401 must come from the missing session,
    // not from CSRF.
    const agent = app.decorate(app.client(), null);
    const csrfRes = await agent.get(app.apiPath('/auth/csrf'));
    const csrfToken = app.csrfFrom(csrfRes);
    agent.setCsrfToken(csrfToken);

    const res = await agent
      .post(app.apiPath('/auth/refresh'))
      .set('Cookie', `${COOKIE_NAMES.csrf}=${csrfToken}`)
      .set(app.CSRF_HEADER, csrfToken)
      .send({});
    expectError(res, 401, 'UNAUTHENTICATED');
  });
});
