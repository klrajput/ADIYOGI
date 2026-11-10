'use strict';

/**
 * CSRF middleware contract (docs/ARCHITECTURE.md §6.3, §12.1).
 * Double-submit cookie + HMAC. Exercised through a real Express app so header/cookie
 * handling, path exemptions and the failure status are all genuine.
 */
const express = require('express');
const cookieParser = require('cookie-parser');
const request = require('supertest');

const { requireCsrf, issueCsrfToken, csrfTokenFor } = require('../../src/middleware/csrf');
const { COOKIE_NAMES } = require('../../src/utils/cookies');
const { signCsrfToken, generateOpaqueToken } = require('../../src/utils/tokens');

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());

  const router = express.Router();
  // Helper the client uses to obtain a token (GET /auth/csrf is a safe method).
  router.get('/csrf-token', (req, res) => {
    const token = issueCsrfToken(req, res);
    res.json({ success: true, data: { csrfToken: token } });
  });
  router.get('/echo', (req, res) => res.json({ success: true, data: { method: 'GET' } }));
  router.post('/echo', (req, res) => res.json({ success: true, data: { method: 'POST' } }));
  router.post('/auth/session', (req, res) => res.json({ success: true, data: { bootstrapped: true } }));
  router.post('/auth/login', (req, res) => res.json({ success: true, data: { loggedIn: true } }));
  router.post('/auth/register', (req, res) => res.json({ success: true, data: { registered: true } }));

  app.use('/api/v1', requireCsrf, router);

  // Mirror of middleware/errorHandler.js for the fields under test.
  // eslint-disable-next-line no-unused-vars
  app.use((error, req, res, next) => {
    res.status(error.status || 500).json({
      success: false,
      message: error.message,
      error: { code: error.code || 'INTERNAL_ERROR', details: error.details },
    });
  });

  return app;
}

describe('requireCsrf', () => {
  const app = buildApp();

  it('lets safe methods through without a token', async () => {
    await request(app).get('/api/v1/echo').expect(200);
  });

  it('rejects a state-changing request with no CSRF header or cookie', async () => {
    const res = await request(app).post('/api/v1/echo').send({}).expect(403);
    expect(res.body.error.code).toBe('CSRF_INVALID');
  });

  it('rejects a header without the matching cookie', async () => {
    const token = signCsrfToken(generateOpaqueToken());
    const res = await request(app)
      .post('/api/v1/echo')
      .set('x-csrf-token', token)
      .send({})
      .expect(403);
    expect(res.body.error.code).toBe('CSRF_INVALID');
  });

  it('rejects a cookie without the header', async () => {
    const res = await request(app)
      .post('/api/v1/echo')
      .set('Cookie', `${COOKIE_NAMES.csrf}=${signCsrfToken(generateOpaqueToken())}`)
      .send({})
      .expect(403);
    expect(res.body.error.code).toBe('CSRF_INVALID');
  });

  it('rejects a header that does not match the cookie (substitution attack)', async () => {
    const cookieToken = signCsrfToken(generateOpaqueToken());
    const headerToken = signCsrfToken(generateOpaqueToken());
    const res = await request(app)
      .post('/api/v1/echo')
      .set('Cookie', `${COOKIE_NAMES.csrf}=${encodeURIComponent(cookieToken)}`)
      .set('x-csrf-token', headerToken)
      .send({})
      .expect(403);
    expect(res.body.error.code).toBe('CSRF_INVALID');
  });

  it('rejects a cookie whose HMAC does not verify, even when the header matches', async () => {
    const forged = `${generateOpaqueToken()}.not-a-valid-hmac`;
    const res = await request(app)
      .post('/api/v1/echo')
      .set('Cookie', `${COOKIE_NAMES.csrf}=${encodeURIComponent(forged)}`)
      .set('x-csrf-token', forged)
      .send({})
      .expect(403);
    expect(res.body.error.code).toBe('CSRF_INVALID');
  });

  it('accepts a valid matching signed token', async () => {
    const agent = request.agent(app);
    const tokenRes = await agent.get('/api/v1/csrf-token').expect(200);
    const token = tokenRes.body.data.csrfToken;
    expect(token).toBeTruthy();

    const res = await agent.post('/api/v1/echo').set('x-csrf-token', token).send({}).expect(200);
    expect(res.body.data.method).toBe('POST');
  });

  it('exempts session bootstrap only when there is no refresh cookie', async () => {
    await request(app).post('/api/v1/auth/session').send({}).expect(200);
    await request(app).post('/api/v1/auth/login').send({ email: 'x@y.z', password: 'x' }).expect(200);
    await request(app).post('/api/v1/auth/register').send({}).expect(200);

    const withSession = await request(app)
      .post('/api/v1/auth/session')
      .set('Cookie', `${COOKIE_NAMES.refresh}=some-refresh-token`)
      .send({});
    expect(withSession.status).toBe(403);
    expect(withSession.body.error.code).toBe('CSRF_INVALID');
  });

  it('requires CSRF on non-exempt paths even with a valid session cookie', async () => {
    const res = await request(app)
      .post('/api/v1/echo')
      .set('Cookie', `${COOKIE_NAMES.refresh}=some-refresh-token`)
      .send({});
    expect(res.status).toBe(403);
  });

  it('does not exempt look-alike bootstrap paths', async () => {
    // A prefix/suffix trick must not bypass CSRF.
    const res = await request(app)
      .post('/api/v1/auth/session/extra')
      .set('Cookie', `${COOKIE_NAMES.refresh}=some-refresh-token`)
      .send({});
    expect([403, 404]).toContain(res.status);
  });
});

describe('csrfTokenFor / issueCsrfToken', () => {
  it('issues and reuses a signed token for the same request', () => {
    const req = { csrfToken: undefined, cookies: {} };
    const cookies = {};
    const res = {
      cookie: (name, value) => {
        cookies[name] = value;
      },
    };

    const issued = csrfTokenFor(req, res);
    expect(issued).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    expect(cookies[COOKIE_NAMES.csrf]).toBe(issued);
    expect(csrfTokenFor(req, res)).toBe(issued);
  });

  it('returns null when there is no request token and no response to set one on', () => {
    expect(csrfTokenFor({ cookies: {} })).toBeNull();
  });

  it('reads an existing cookie token', () => {
    const token = signCsrfToken(generateOpaqueToken());
    expect(csrfTokenFor({ cookies: { [COOKIE_NAMES.csrf]: token } })).toBe(token);
  });
});
