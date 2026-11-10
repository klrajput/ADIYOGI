'use strict';

/**
 * Response envelope helpers (docs/ARCHITECTURE.md §4.1, §12.2).
 * Uses a real Express app + supertest instead of stubbing `res`, so the assertions are
 * about the bytes a client actually receives.
 */
const express = require('express');
const request = require('supertest');

const { ok, created, noContent, fail } = require('../../src/utils/response');
const requestId = require('../../src/middleware/requestId');
const ApiError = require('../../src/utils/ApiError');

function buildApp() {
  const app = express();
  app.use(requestId);
  app.use(express.json());

  app.get('/ok', (req, res) => ok(res, { id: 'abc' }, { message: 'Fetched', meta: { page: 1 } }));
  app.get('/ok-defaults', (req, res) => ok(res, [1, 2, 3]));
  app.post('/created', (req, res) => created(res, { id: 'new' }, { message: 'Thread created' }));
  app.get('/no-content', (req, res) => noContent(res));
  app.get('/fail-controlled', (req, res, next) =>
    next(ApiError.conflict('Already reported', { targetId: 't1' }))
  );
  app.get('/fail-unexpected', (req, res, next) => next(new Error('boom: internal detail')));
  // Final error middleware: the same contract as middleware/errorHandler.js.
  // eslint-disable-next-line no-unused-vars
  app.use((error, req, res, next) => fail(res, error));

  return app;
}

describe('success envelope', () => {
  const app = buildApp();

  it('ok() always returns {success,message,data,meta}', async () => {
    const res = await request(app).get('/ok').expect(200);
    expect(res.body).toEqual({
      success: true,
      message: 'Fetched',
      data: { id: 'abc' },
      meta: { page: 1 },
    });
  });

  it('ok() supplies defaults so the envelope is never partial', async () => {
    const res = await request(app).get('/ok-defaults').expect(200);
    expect(res.body).toEqual({ success: true, message: 'OK', data: [1, 2, 3], meta: {} });
  });

  it('created() returns 201 with the success envelope', async () => {
    const res = await request(app).post('/created').expect(201);
    expect(res.body).toEqual({
      success: true,
      message: 'Thread created',
      data: { id: 'new' },
      meta: {},
    });
  });

  it('noContent() returns 204 with no body', async () => {
    const res = await request(app).get('/no-content').expect(204);
    expect(res.text).toBe('');
  });
});

describe('error envelope', () => {
  const app = buildApp();

  it('fail() returns {success:false,message,error:{code,details},requestId}', async () => {
    const res = await request(app).get('/fail-controlled').expect(409);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('Already reported');
    expect(res.body.error.code).toBe('CONFLICT');
    expect(res.body.error.details).toEqual({ targetId: 't1' });
    expect(res.body.requestId).toBe(res.headers['x-request-id']);
  });

  it('fail() maps an unexpected exception to 500 INTERNAL_ERROR', async () => {
    const res = await request(app).get('/fail-unexpected').expect(500);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('INTERNAL_ERROR');
    expect(res.body.message).toBe('boom: internal detail');
  });

  it('the error envelope never leaks a stack', async () => {
    const res = await request(app).get('/fail-unexpected').expect(500);
    expect(JSON.stringify(res.body)).not.toContain('at ');
  });
});
