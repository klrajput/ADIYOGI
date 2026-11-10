'use strict';

/**
 * Terminal error handling (docs/ARCHITECTURE.md §4.1, §4.2, §12.1).
 *
 * Every error — thrown, rejected, or produced by body-parser / Mongoose / JWT —
 * is normalised to the standard envelope:
 *
 *   { success:false, message, error:{ code, details? }, requestId }
 *
 * Production responses never include stack traces, database details, driver messages
 * or the offending value. 5xx errors are logged with stack + requestId; 4xx errors
 * are logged at debug without bodies.
 */
const logger = require('../config/logger');
const ApiError = require('../utils/ApiError');

const JWT_ERROR_NAMES = new Set(['JsonWebTokenError', 'TokenExpiredError', 'NotBeforeError']);
const GENERIC_500_MESSAGE = 'Something went wrong on our side';

/**
 * Strip control characters from a path before logging it.
 * @param {import('express').Request} req
 * @returns {string}
 */
function safePath(req) {
  const raw = (req && (req.path || req.originalUrl)) || '/';
  // eslint-disable-next-line no-control-regex
  return String(raw).split('?')[0].replace(/[\u0000-\u001F\u007F]/g, '').slice(0, 512) || '/';
}

/**
 * Normalise any error into `{ status, code, message, details? }`.
 * @param {*} error
 * @returns {{status:number, code:string, message:string, details?:*}}
 */
function normaliseError(error) {
  if (error instanceof ApiError) {
    return {
      status: error.status || 500,
      code: error.code || 'INTERNAL_ERROR',
      message: error.message || GENERIC_500_MESSAGE,
      details: error.details,
    };
  }

  // Our token verifier's clean error (utils/tokens.js).
  if (error && error.code === 'INVALID_ACCESS_TOKEN') {
    return { status: 401, code: 'UNAUTHENTICATED', message: 'Invalid or expired session' };
  }

  // zod (also thrown directly by services).
  if (error && error.name === 'ZodError' && Array.isArray(error.issues)) {
    const details = error.issues.slice(0, 50).map((issue) => ({
      path: (issue.path || []).join('.'),
      message: issue.message,
    }));
    return { status: 400, code: 'VALIDATION_ERROR', message: 'Validation failed', details };
  }

  // Mongoose schema validation.
  if (error && error.name === 'ValidationError' && error.errors && typeof error.errors === 'object') {
    const details = Object.entries(error.errors).map(([field, issue]) => ({
      path: issue && issue.path ? issue.path : field,
      message: (issue && issue.message) || 'Invalid value',
    }));
    return { status: 400, code: 'VALIDATION_ERROR', message: 'Validation failed', details };
  }

  // Mongoose cast failure (e.g. malformed ObjectId in a route param).
  if (error && error.name === 'CastError') {
    return {
      status: 400,
      code: 'VALIDATION_ERROR',
      message: 'Invalid identifier or value',
      details: error.path ? [{ path: error.path, message: 'Invalid value' }] : undefined,
    };
  }

  // MongoDB duplicate key.
  if (error && (error.code === 11000 || error.code === 11001)) {
    const fields = Object.keys(error.keyPattern || error.keyValue || {});
    return {
      status: 409,
      code: 'CONFLICT',
      message: 'That resource already exists',
      details: fields.length ? { fields } : undefined,
    };
  }

  // jsonwebtoken errors that escaped verifyAccessToken (e.g. a route verifying directly).
  if (error && JWT_ERROR_NAMES.has(error.name)) {
    return { status: 401, code: 'UNAUTHENTICATED', message: 'Invalid or expired session' };
  }

  // body-parser / raw-body failures.
  if (error && error.type === 'entity.too.large') {
    return {
      status: 413,
      code: 'PAYLOAD_TOO_LARGE',
      message: 'Request body is too large',
    };
  }
  if (error && (error.type === 'entity.parse.failed' || error.type === 'encoding.unsupported')) {
    return {
      status: 400,
      code: 'VALIDATION_ERROR',
      message: 'Malformed request body',
    };
  }

  return { status: 500, code: 'INTERNAL_ERROR', message: GENERIC_500_MESSAGE };
}

/**
 * 404 handler; place after all routes, before errorHandler.
 * @param {import('express').Request} req
 * @param {import('express').Response} _res
 * @param {import('express').NextFunction} next
 * @returns {void}
 */
function notFound(req, _res, next) {
  return next(ApiError.notFound('The requested endpoint does not exist'));
}

/**
 * Final error middleware.
 * @param {*} error
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {void}
 */
function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);

  const normalised = normaliseError(error);
  const status = normalised.status;

  // Never leak internals on 5xx unless the ApiError explicitly marks itself exposable
  // (AI_UNAVAILABLE / SERVICE_UNAVAILABLE keep their operator-written messages).
  const exposable = error instanceof ApiError && error.expose;
  const message = status >= 500 && !exposable ? GENERIC_500_MESSAGE : normalised.message;

  if (status >= 500) {
    logger.error('Request failed', {
      requestId: req.id,
      status,
      method: req.method,
      path: safePath(req),
      message: error && error.message ? error.message : String(error),
      stack: error && error.stack,
    });
  } else {
    logger.debug('Request rejected', {
      requestId: req.id,
      status,
      code: normalised.code,
      method: req.method,
      path: safePath(req),
    });
  }

  const body = {
    success: false,
    message,
    error: { code: normalised.code },
    requestId: req.id,
  };
  if (normalised.details !== undefined && normalised.details !== null) {
    body.error.details = normalised.details;
  }

  return res.status(status).json(body);
}

module.exports = { errorHandler, notFound };
