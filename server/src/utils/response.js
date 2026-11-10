'use strict';

/**
 * Consistent response envelopes (docs/ARCHITECTURE.md §4.1).
 * Routes must return through these helpers so clients can rely on the shape.
 */

function ok(res, data = {}, { message = 'OK', meta = {}, status = 200 } = {}) {
  return res.status(status).json({ success: true, message, data, meta });
}

function created(res, data = {}, { message = 'Created', meta = {} } = {}) {
  return ok(res, data, { message, meta, status: 201 });
}

function noContent(res) {
  return res.status(204).end();
}

function fail(res, error) {
  return res.status(error.status || 500).json({
    success: false,
    message: error.message || 'Something went wrong',
    error: { code: error.code || 'INTERNAL_ERROR', details: error.details },
    requestId: res.req ? res.req.id : undefined,
  });
}

module.exports = { ok, created, noContent, fail };
