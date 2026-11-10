'use strict';

/**
 * ApiError contract (docs/ARCHITECTURE.md §4.2, §12.2).
 * Every static must map to the frozen (status, code) pair, and 5xx errors must not be
 * exposed as-is unless they are explicitly user-safe (AI/DB unavailability).
 */
const ApiError = require('../../src/utils/ApiError');

describe('ApiError statics → HTTP status / error code', () => {
  it.each([
    ['badRequest', ApiError.badRequest(), 400, 'VALIDATION_ERROR'],
    ['badRequest custom code', ApiError.badRequest('CONTENT_BLOCKED'), 400, 'CONTENT_BLOCKED'],
    ['unauthorized', ApiError.unauthorized(), 401, 'UNAUTHENTICATED'],
    ['forbidden', ApiError.forbidden(), 403, 'FORBIDDEN'],
    ['csrf', ApiError.csrf(), 403, 'CSRF_INVALID'],
    ['notFound', ApiError.notFound(), 404, 'NOT_FOUND'],
    ['conflict', ApiError.conflict(), 409, 'CONFLICT'],
    ['tooMany', ApiError.tooMany(), 429, 'RATE_LIMITED'],
    ['unprocessable', ApiError.unprocessable(), 422, 'CONTENT_BLOCKED'],
    ['aiUnavailable', ApiError.aiUnavailable(), 503, 'AI_UNAVAILABLE'],
    ['serviceUnavailable', ApiError.serviceUnavailable(), 503, 'SERVICE_UNAVAILABLE'],
    ['internal', ApiError.internal(), 500, 'INTERNAL_ERROR'],
  ])('%s maps to status %i and code %s', (_label, error, status, code) => {
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(status);
    expect(error.code).toBe(code);
    expect(typeof error.message).toBe('string');
    expect(error.message.length).toBeGreaterThan(0);
  });
});

describe('ApiError details and message contract', () => {
  it('carries optional structured details', () => {
    const details = [{ path: 'body.title', message: 'Required' }];
    const error = new ApiError(400, 'VALIDATION_ERROR', 'Validation failed', details);
    expect(error.details).toEqual(details);
  });

  it('omits details entirely when not supplied', () => {
    const error = ApiError.notFound('Thread not found');
    expect('details' in error).toBe(false);
    expect(error.message).toBe('Thread not found');
  });

  it('passes details through the statics that accept them', () => {
    expect(ApiError.conflict('Already reported', { targetId: 'x' }).details).toEqual({ targetId: 'x' });
    expect(ApiError.aiUnavailable('down', { canUseGuidedMode: true }).details).toEqual({
      canUseGuidedMode: true,
    });
  });

  it('exposes a retryAfterSeconds detail for rate limits', () => {
    const error = ApiError.tooMany('slow down', 42);
    expect(error.details).toEqual({ retryAfterSeconds: 42 });
  });
});

describe('ApiError exposure rules', () => {
  it('exposes 4xx errors to the client', () => {
    expect(ApiError.badRequest().expose).toBe(true);
    expect(ApiError.unauthorized().expose).toBe(true);
    expect(ApiError.notFound().expose).toBe(true);
  });

  it('hides unexpected 500 errors behind a generic message', () => {
    const error = ApiError.internal();
    expect(error.expose).toBe(false);
    expect(error.message).not.toMatch(/stack|mongo|mongoerror/i);
  });

  it('exposes the documented user-safe 503 codes', () => {
    expect(ApiError.aiUnavailable().expose).toBe(true);
    expect(ApiError.serviceUnavailable().expose).toBe(true);
  });

  it('captures a stack trace', () => {
    const error = new ApiError(400, 'VALIDATION_ERROR', 'bad');
    expect(typeof error.stack).toBe('string');
    expect(error.stack).toContain('ApiError');
  });
});
