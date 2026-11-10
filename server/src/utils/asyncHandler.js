'use strict';

/**
 * Wraps an async route handler so rejected promises reach the error middleware.
 * @param {Function} fn express handler
 * @returns {Function} wrapped handler
 */
module.exports = function asyncHandler(fn) {
  return function handler(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
