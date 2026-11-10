'use strict';

/**
 * Operational error with an HTTP status and a machine-readable code.
 * Every non-2xx response produced by the API goes through this class so the
 * error envelope stays consistent (see docs/ARCHITECTURE.md §4.1).
 */
class ApiError extends Error {
  /**
   * @param {number} status HTTP status code
   * @param {string} code machine-readable code (e.g. VALIDATION_ERROR)
   * @param {string} message human-readable message safe to show to users
   * @param {*} [details] optional structured details (never includes secrets)
   */
  constructor(status, code, message, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    if (details !== undefined) this.details = details;
    this.expose = status < 500 || [
      'AI_UNAVAILABLE',
      'SERVICE_UNAVAILABLE',
    ].includes(code);
    Error.captureStackTrace(this, ApiError);
  }

  static badRequest(code = 'VALIDATION_ERROR', message = 'Invalid request', details) {
    return new ApiError(400, code, message, details);
  }

  static unauthorized(message = 'Authentication required', code = 'UNAUTHENTICATED', details) {
    return new ApiError(401, code, message, details);
  }

  static forbidden(message = 'You are not allowed to do that', code = 'FORBIDDEN', details) {
    return new ApiError(403, code, message, details);
  }

  static csrf(message = 'Invalid or missing CSRF token') {
    return new ApiError(403, 'CSRF_INVALID', message);
  }

  static notFound(message = 'Resource not found') {
    return new ApiError(404, 'NOT_FOUND', message);
  }

  static conflict(message = 'Resource already exists', details) {
    return new ApiError(409, 'CONFLICT', message, details);
  }

  static requestTooLarge(message = 'Request body is too large') {
    return new ApiError(413, 'PAYLOAD_TOO_LARGE', message);
  }

  static unprocessable(code = 'CONTENT_BLOCKED', message = 'Content violates our guidelines', details) {
    return new ApiError(422, code, message, details);
  }

  static tooMany(message = 'Too many requests, please slow down', retryAfterSeconds = 60) {
    return new ApiError(429, 'RATE_LIMITED', message, { retryAfterSeconds });
  }

  static aiUnavailable(message = 'The AI companion is temporarily unavailable', details) {
    return new ApiError(503, 'AI_UNAVAILABLE', message, details);
  }

  static serviceUnavailable(message = 'Service temporarily unavailable', details) {
    return new ApiError(503, 'SERVICE_UNAVAILABLE', message, details);
  }

  static internal(message = 'Something went wrong on our side') {
    return new ApiError(500, 'INTERNAL_ERROR', message);
  }
}

module.exports = ApiError;
