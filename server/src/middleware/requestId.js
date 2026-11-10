'use strict';

/**
 * Request correlation id (docs/ARCHITECTURE.md §12.1).
 *
 * A server-generated UUID is used (never a client-supplied value) so request ids
 * cannot be spoofed or used for log injection, and every response — including
 * errors — carries the id both in the body envelope (`requestId`) and the
 * `X-Request-Id` header.
 */
const crypto = require('crypto');

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {void}
 */
module.exports = function requestId(req, res, next) {
  req.id = crypto.randomUUID();
  res.setHeader('X-Request-Id', req.id);
  next();
};
