'use strict';

/**
 * Zod request validation middleware (docs/ARCHITECTURE.md §4.1, §12.1).
 *
 * Usage:
 *   router.post('/', validate({ body: createThreadSchema }), controller)
 *   router.get('/:id', validate({ params: idParamsSchema, query: listQuerySchema }), ctrl)
 *
 * On success the parsed values replace `req.params` / `req.query` / `req.body`
 * (so coercion, `.default()` and unknown-key stripping are applied downstream).
 * On failure the request is rejected with `400 VALIDATION_ERROR` and
 * `error.details = [{ path, message }]`.
 */
const ApiError = require('../utils/ApiError');

const SOURCES = ['params', 'query', 'body'];
const MAX_DETAILS = 50;

/**
 * Assign a parsed source back onto the request. Express 4 defines `req.query` as a
 * prototype getter; direct assignment works on current Express 4, but a defineProperty
 * fallback keeps this safe if the property becomes getter-only.
 * @param {import('express').Request} req
 * @param {'params'|'query'|'body'} key
 * @param {*} value
 * @returns {void}
 */
function assignSource(req, key, value) {
  try {
    req[key] = value;
  } catch {
    Object.defineProperty(req, key, {
      value,
      writable: true,
      enumerable: true,
      configurable: true,
    });
  }
}

/**
 * Build validation middleware.
 * @param {{params?:object, query?:object, body?:object}} schemas zod schemas per source
 * @returns {import('express').RequestHandler}
 */
function validate(schemas = {}) {
  if (!schemas || typeof schemas !== 'object' || Array.isArray(schemas)) {
    throw new TypeError('validate() requires an object: { body?, query?, params? }');
  }

  // Fail fast at boot if a route wires a non-schema, instead of 500-ing at runtime.
  SOURCES.forEach((key) => {
    const schema = schemas[key];
    if (schema === undefined) return;
    if (!schema || typeof schema.safeParse !== 'function') {
      throw new TypeError(`validate(): \`${key}\` must be a zod schema`);
    }
  });

  return function validateMiddleware(req, _res, next) {
    for (const key of SOURCES) {
      const schema = schemas[key];
      if (!schema) continue;

      const input = req[key] === undefined || req[key] === null ? {} : req[key];
      const result = schema.safeParse(input);

      if (!result.success) {
        const details = (result.error.issues || []).slice(0, MAX_DETAILS).map((issue) => ({
          path: [key, ...issue.path].join('.'),
          message: issue.message,
        }));
        return next(ApiError.badRequest('VALIDATION_ERROR', 'Validation failed', details));
      }

      assignSource(req, key, result.data);
    }

    return next();
  };
}

module.exports = validate;
