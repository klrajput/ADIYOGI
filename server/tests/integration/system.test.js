'use strict';

/**
 * System-level integration tests: health probes, error envelopes, payload limits,
 * request ids, CORS, security headers, API docs and endpoint mounting
 * (docs/ARCHITECTURE.md §4, §12).
 */
const express = require('express');

const env = require('../../src/config/env');
const db = require('../helpers/db');
const app = require('../helpers/app');
const { expectError } = require('../helpers/envelopes');

jest.setTimeout(60000);

beforeAll(async () => {
  await db.startDatabase();
});

afterAll(async () => {
  await db.stopDatabase();
});

describe('health probes', () => {
  it.each(['/health', '/healthz', '/api/v1/health'])('GET %s returns liveness data', async (path) => {
    const res = await app.client().get(path);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('ok');
    expect(typeof res.body.data.uptime).toBe('number');
    expect(typeof res.body.data.version).toBe('string');
  });

  it('GET /health/ready reports readiness with a connected database', async () => {
    const res = await app.client().get('/health/ready');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('ok');
    expect(res.body.data.db).toBe('connected');
  });
});

describe('404 and error envelopes', () => {
  it('returns the error envelope for an unknown API route', async () => {
    const res = await app.client().get(app.apiPath('/definitely-not-a-route'));
    const error = expectError(res, 404, 'NOT_FOUND');
    expect(error).toBeTruthy();
    expect(res.body.message).toMatch(/does not exist/i);
    expect(res.body).toHaveProperty('requestId');
  });

  it('returns the error envelope for an unknown non-API route', async () => {
    const res = await app.client().get('/nope');
    expectError(res, 404, 'NOT_FOUND');
  });

  it('rejects malformed JSON with a 400 VALIDATION_ERROR (never a 500)', async () => {
    const res = await app
      .client()
      .post(app.apiPath('/threads'))
      .set('Content-Type', 'application/json')
      .send('{"title": ');
    expectError(res, 400, 'VALIDATION_ERROR');
  });

  it('rejects an oversized JSON body with 413 PAYLOAD_TOO_LARGE', async () => {
    const res = await app
      .client()
      .post(app.apiPath('/threads'))
      .send({ boardSlug: 'general-support', title: 'big', body: 'x'.repeat(200 * 1024) });
    expectError(res, 413, 'PAYLOAD_TOO_LARGE');
  });
});

describe('request correlation id', () => {
  it('is present on every response, including errors', async () => {
    const ok = await app.client().get('/health');
    expect(ok.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/i);

    const notFound = await app.client().get(app.apiPath('/nope'));
    expect(notFound.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/i);
    expect(notFound.body.requestId).toBe(notFound.headers['x-request-id']);

    const two = await app.client().get('/health');
    expect(two.headers['x-request-id']).not.toBe(ok.headers['x-request-id']);
  });
});

describe('security headers (helmet)', () => {
  it('sets hardening headers and no X-Powered-By', async () => {
    const res = await app.client().get('/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('DENY');
    expect(res.headers['referrer-policy']).toBe('no-referrer');
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['content-security-policy']).toContain("default-src 'none'");
  });
});

describe('CORS allow-list', () => {
  const allowedOrigin = env.corsOrigins[0];

  it('reflects an allowed origin with credentials', async () => {
    const res = await app.client().get('/health').set('Origin', allowedOrigin);
    expect(res.headers['access-control-allow-origin']).toBe(allowedOrigin);
    expect(res.headers['access-control-allow-credentials']).toBe('true');
  });

  it('sends no CORS headers for a disallowed origin', async () => {
    const res = await app.client().get('/health').set('Origin', 'https://evil.example');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('rejects a disallowed preflight with 403', async () => {
    const res = await app
      .client()
      .options('/health')
      .set('Origin', 'https://evil.example')
      .set('Access-Control-Request-Method', 'GET');
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });
});

describe('API documentation', () => {
  it('serves a parsable OpenAPI document with the documented paths', async () => {
    const res = await app.client().get('/api/docs/openapi.json');
    expect(res.status).toBe(200);
    const spec = res.body;
    expect(spec.openapi).toMatch(/^3\./);
    expect(spec.info.title).toBeTruthy();
    expect(spec.paths).toBeTruthy();

    const documentedPaths = [
      '/api/v1/auth/session',
      '/api/v1/auth/me',
      '/api/v1/auth/csrf',
      '/api/v1/auth/register',
      '/api/v1/auth/login',
      '/api/v1/auth/logout',
      '/api/v1/auth/refresh',
      '/api/v1/users/me/preferences',
      '/api/v1/users/me/content',
      '/api/v1/users/me',
      '/api/v1/boards',
      '/api/v1/boards/{slug}',
      '/api/v1/threads',
      '/api/v1/threads/{id}',
      '/api/v1/threads/{id}/replies',
      '/api/v1/replies/{id}',
      '/api/v1/reports',
      '/api/v1/reports/{id}',
      '/api/v1/moderation/queue',
      '/api/v1/moderation/actions',
      '/api/v1/moderation/stats',
      '/api/v1/notifications',
      '/api/v1/notifications/{id}/read',
      '/api/v1/notifications/read-all',
      '/api/v1/chat/conversations',
      '/api/v1/chat/conversations/{id}',
      '/api/v1/chat/conversations/{id}/messages',
      '/api/v1/crisis/resources',
      '/api/v1/crisis/assess',
      '/api/v1/crisis/events',
      '/api/v1/health',
    ];
    documentedPaths.forEach((path) => {
      expect(Object.keys(spec.paths)).toContain(path);
    });
  });

  it('serves Swagger UI HTML at /api/docs with a relaxed docs CSP', async () => {
    const res = await app.client().get('/api/docs/');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/html/);
    expect(res.headers['content-security-policy']).toContain("script-src 'self' 'unsafe-inline'");
  });
});

/**
 * Every endpoint documented in ARCHITECTURE §4.3 must be mounted. A request that reaches
 * a router yields a domain response (200/201/204/400/401/403/404 resource-level); an
 * unmounted path yields the generic "endpoint does not exist" 404.
 */
describe('documented endpoint mounting (§4.3)', () => {
  const GENERIC_404 = 'The requested endpoint does not exist';
  const RANDOM_ID = '507f1f77bcf86cd799439011';

  const endpoints = [
    ['post', '/auth/session'],
    ['get', '/auth/me'],
    ['get', '/auth/csrf'],
    ['post', '/auth/register'],
    ['post', '/auth/login'],
    ['post', '/auth/logout'],
    ['post', '/auth/refresh'],
    ['get', '/users/me/preferences'],
    ['patch', '/users/me/preferences'],
    ['get', '/users/me/content'],
    ['delete', '/users/me'],
    ['get', '/boards'],
    ['get', '/boards/general-support'],
    ['post', '/boards'],
    ['patch', '/boards/general-support'],
    ['delete', '/boards/general-support'],
    ['get', '/threads'],
    ['post', '/threads'],
    ['get', `/threads/${RANDOM_ID}`],
    ['patch', `/threads/${RANDOM_ID}`],
    ['delete', `/threads/${RANDOM_ID}`],
    ['get', `/threads/${RANDOM_ID}/replies`],
    ['post', `/threads/${RANDOM_ID}/replies`],
    ['delete', `/replies/${RANDOM_ID}`],
    ['post', '/reports'],
    ['get', '/reports'],
    ['patch', `/reports/${RANDOM_ID}`],
    ['get', '/moderation/queue'],
    ['post', '/moderation/actions'],
    ['get', '/moderation/actions'],
    ['get', '/moderation/stats'],
    ['get', '/notifications'],
    ['patch', `/notifications/${RANDOM_ID}/read`],
    ['post', '/notifications/read-all'],
    ['get', '/chat/conversations'],
    ['post', '/chat/conversations'],
    ['get', `/chat/conversations/${RANDOM_ID}`],
    ['post', `/chat/conversations/${RANDOM_ID}/messages`],
    ['delete', `/chat/conversations/${RANDOM_ID}`],
    ['get', '/crisis/resources'],
    ['post', '/crisis/assess'],
    ['post', '/crisis/events'],
    ['get', '/health'],
  ];

  it('mounts all of them', async () => {
    const agent = await app.anonymousAgent();
    const problems = [];

    for (const [method, path] of endpoints) {
      // eslint-disable-next-line no-await-in-loop
      const res = await agent[method](app.apiPath(path));
      const isGeneric404 = res.status === 404 && res.body?.message === GENERIC_404;
      if (isGeneric404) problems.push(`${method.toUpperCase()} ${path}`);
    }

    expect(problems).toEqual([]);
  }, 120000);
});

describe('app is importable and testable without binding a port', () => {
  it('createApp() returns an Express app without listening', () => {
    const createApp = require('../../src/app');
    const fresh = createApp();
    expect(typeof fresh.use).toBe('function');
    expect(typeof express).toBe('function'); // sanity: express dependency present
  });
});
