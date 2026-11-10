'use strict';

/**
 * Cross-cutting HTTP middleware (docs/ARCHITECTURE.md §12.1):
 * request correlation id, security headers, CORS allow-list.
 * Asserted over real HTTP through a minimal Express app that mounts the production
 * middleware instances.
 */
const express = require('express');
const request = require('supertest');

const env = require('../../src/config/env');
const requestId = require('../../src/middleware/requestId');
const securityHeaders = require('../../src/middleware/securityHeaders');
const corsMiddleware = require('../../src/middleware/cors');

function buildApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(requestId);
  app.use(securityHeaders);
  app.use(corsMiddleware);
  app.get('/ping', (req, res) => res.json({ success: true, data: { id: req.id } }));
  app.post('/ping', (req, res) => res.json({ success: true }));
  // eslint-disable-next-line no-unused-vars
  app.use((error, req, res, next) => {
    res.status(error.status || 500).json({
      success: false,
      message: error.message,
      error: { code: error.code || 'INTERNAL_ERROR' },
      requestId: req.id,
    });
  });
  return app;
}

describe('requestId middleware', () => {
  const app = buildApp();

  it('sets an X-Request-Id response header with a UUID', async () => {
    const res = await request(app).get('/ping').expect(200);
    const header = res.headers['x-request-id'];
    expect(header).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    expect(res.body.data.id).toBe(header);
  });

  it('generates a different id per request (never trusts a client value)', async () => {
    const first = await request(app).get('/ping').set('x-request-id', 'client-supplied').expect(200);
    const second = await request(app).get('/ping').set('x-request-id', 'client-supplied').expect(200);
    expect(first.headers['x-request-id']).not.toBe('client-supplied');
    expect(first.headers['x-request-id']).not.toBe(second.headers['x-request-id']);
  });
});

describe('security headers (helmet)', () => {
  const app = buildApp();

  it('sets the baseline hardening headers', async () => {
    const res = await request(app).get('/ping').expect(200);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('DENY');
    expect(res.headers['referrer-policy']).toBe('no-referrer');
    expect(res.headers['cross-origin-resource-policy']).toBe('same-origin');
    expect(res.headers['x-permitted-cross-domain-policies']).toBe('none');
  });

  it('locks the JSON API CSP down to default-src none', async () => {
    const res = await request(app).get('/ping').expect(200);
    const csp = res.headers['content-security-policy'];
    expect(csp).toBeDefined();
    expect(csp).toContain("default-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).not.toContain('unsafe-eval');
  });

  it('does not advertise Express (X-Powered-By absent)', async () => {
    const res = await request(app).get('/ping').expect(200);
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});

describe('CORS allow-list', () => {
  const app = buildApp();
  const allowedOrigin = env.corsOrigins[0];

  it('refuses to reflect arbitrary origins with credentials', () => {
    expect(allowedOrigin).toBeTruthy();
    expect(allowedOrigin).not.toBe('*');
    expect(env.corsOrigins).not.toContain('*');
  });

  it('reflects an allow-listed origin and allows credentials', async () => {
    const res = await request(app).get('/ping').set('Origin', allowedOrigin).expect(200);
    expect(res.headers['access-control-allow-origin']).toBe(allowedOrigin);
    expect(res.headers['access-control-allow-credentials']).toBe('true');
  });

  it('adds no CORS headers for a disallowed origin', async () => {
    const res = await request(app).get('/ping').set('Origin', 'https://evil.example').expect(200);
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('answers a preflight from an allowed origin', async () => {
    const res = await request(app)
      .options('/ping')
      .set('Origin', allowedOrigin)
      .set('Access-Control-Request-Method', 'PATCH')
      .expect(204);
    expect(res.headers['access-control-allow-origin']).toBe(allowedOrigin);
    expect(res.headers['access-control-allow-methods']).toMatch(/PATCH/);
    expect(res.headers['access-control-allow-headers']).toMatch(/x-csrf-token/i);
  });

  it('rejects a preflight from a disallowed origin with the error envelope', async () => {
    const res = await request(app)
      .options('/ping')
      .set('Origin', 'https://evil.example')
      .set('Access-Control-Request-Method', 'POST');
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('passes same-origin/server-to-server requests without an Origin header', async () => {
    const res = await request(app).get('/ping').expect(200);
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});
