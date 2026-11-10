'use strict';

/**
 * Rate limiter contract (docs/ARCHITECTURE.md §6.5, §12.1).
 * All limiters must reply with the standard error envelope and a 429 code, plus the
 * documented retryAfterSeconds detail.
 */
const express = require('express');
const request = require('supertest');

const { reportLimiter, keyFor, LIMITS } = require('../../src/middleware/rateLimiters');

function buildApp() {
  const app = express();
  app.post('/reports', reportLimiter, (req, res) => res.json({ success: true }));
  app.get('/reports', (req, res) => res.json({ success: true }));
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

describe('rate limiter configuration', () => {
  it('matches the documented limits (§6.5)', () => {
    expect(LIMITS.auth).toEqual({ windowMs: 15 * 60 * 1000, max: 10 });
    expect(LIMITS.write).toEqual({ windowMs: 10 * 60 * 1000, max: 20 });
    expect(LIMITS.report).toEqual({ windowMs: 60 * 60 * 1000, max: 10 });
    expect(LIMITS.crisisAssess).toEqual({ windowMs: 10 * 60 * 1000, max: 30 });
    expect(LIMITS.chat).toEqual({ windowMs: 5 * 60 * 1000, max: 20 });
  });
});

describe('keyFor', () => {
  it('keys authenticated requests by server-side session id', () => {
    expect(keyFor({ identity: { sessionId: 'session-abc' }, ip: '203.0.113.5' })).toBe(
      'session:session-abc'
    );
  });

  it('keys unauthenticated requests by hashed IP (never the raw address)', () => {
    const key = keyFor({ identity: null, ip: '203.0.113.5' });
    expect(key).toMatch(/^ip:[a-f0-9]{32}$/);
    expect(key).not.toContain('203.0.113.5');
  });
});

describe('limiter response', () => {
  it('returns 429 RATE_LIMITED with retryAfterSeconds once the budget is spent', async () => {
    const app = buildApp();
    const limit = LIMITS.report.max;

    for (let index = 0; index < limit; index += 1) {
      // eslint-disable-next-line no-await-in-loop
      await request(app).post('/reports').send({}).expect(200);
    }

    const blocked = await request(app).post('/reports').send({}).expect(429);
    expect(blocked.body.success).toBe(false);
    expect(blocked.body.error.code).toBe('RATE_LIMITED');
    expect(typeof blocked.body.error.details.retryAfterSeconds).toBe('number');
    expect(blocked.body.error.details.retryAfterSeconds).toBeGreaterThan(0);
    expect(Number(blocked.body.error.details.retryAfterSeconds)).toBeLessThanOrEqual(60 * 60);
    expect(blocked.headers['retry-after']).toBeDefined();
  }, 30000);
});
