'use strict';

/**
 * Envelope assertions for API tests (docs/ARCHITECTURE.md §4.1/§4.2).
 *
 * Using these helpers everywhere keeps the suite honest: every response must carry the
 * frozen envelope, and every error must carry the frozen machine-readable code.
 */

/**
 * Assert a success envelope and return the `data` payload.
 * @param {import('supertest').Response} res
 * @returns {*}
 */
function expectSuccess(res) {
  const label = `${res.req ? res.req.method : '?'} ${res.req ? res.req.path : '?'}`;
  if (res.status < 200 || res.status >= 300) {
    throw new Error(`Expected 2xx for ${label}, got ${res.status}: ${JSON.stringify(res.body)}`);
  }
  const body = res.body || {};
  if (body.success !== true) {
    throw new Error(`Expected success envelope for ${label}, got: ${JSON.stringify(body)}`);
  }
  if (!Object.prototype.hasOwnProperty.call(body, 'data')) {
    throw new Error(`Success envelope for ${label} is missing "data": ${JSON.stringify(body)}`);
  }
  if (!Object.prototype.hasOwnProperty.call(body, 'meta')) {
    throw new Error(`Success envelope for ${label} is missing "meta": ${JSON.stringify(body)}`);
  }
  return body.data;
}

/**
 * Assert an error response with an exact status and error code.
 * @param {import('supertest').Response} res
 * @param {number} status expected HTTP status
 * @param {string} code expected `error.code`
 * @returns {object} the `error` object
 */
function expectError(res, status, code) {
  const label = `${res.req ? res.req.method : '?'} ${res.req ? res.req.path : '?'}`;
  if (res.status !== status) {
    throw new Error(
      `Expected HTTP ${status} (${code}) for ${label}, got ${res.status}: ${JSON.stringify(res.body)}`
    );
  }
  const body = res.body || {};
  if (body.success !== false) {
    throw new Error(`Expected error envelope for ${label}, got: ${JSON.stringify(body)}`);
  }
  if (!body.error || body.error.code !== code) {
    throw new Error(
      `Expected error.code "${code}" for ${label}, got "${body.error && body.error.code}": ${JSON.stringify(body)}`
    );
  }
  if (typeof body.message !== 'string' || body.message.length === 0) {
    throw new Error(`Error envelope for ${label} is missing a message: ${JSON.stringify(body)}`);
  }
  return body.error;
}

/**
 * Assert the pagination meta block matches the frozen shape and arithmetic.
 * @param {{page:number,limit:number,total:number,totalPages:number,hasNext:boolean,hasPrev:boolean}} meta
 * @param {{page?:number,limit?:number,total?:number}} [expected]
 * @returns {object} meta
 */
function expectPaginationMeta(meta, expected = {}) {
  if (!meta || typeof meta !== 'object') {
    throw new Error(`Expected pagination meta, got: ${JSON.stringify(meta)}`);
  }
  ['page', 'limit', 'total', 'totalPages', 'hasNext', 'hasPrev'].forEach((key) => {
    if (!(key in meta)) throw new Error(`Pagination meta is missing "${key}": ${JSON.stringify(meta)}`);
  });
  if (expected.page !== undefined) {
    if (meta.page !== expected.page) throw new Error(`Expected page ${expected.page}, got ${meta.page}`);
  }
  if (expected.limit !== undefined) {
    if (meta.limit !== expected.limit) throw new Error(`Expected limit ${expected.limit}, got ${meta.limit}`);
  }
  if (expected.total !== undefined) {
    if (meta.total !== expected.total) throw new Error(`Expected total ${expected.total}, got ${meta.total}`);
  }
  const computedPages = meta.limit > 0 ? Math.ceil(meta.total / meta.limit) : 0;
  if (meta.totalPages !== computedPages) {
    throw new Error(`totalPages ${meta.totalPages} does not match ceil(${meta.total}/${meta.limit})=${computedPages}`);
  }
  if (meta.hasNext !== meta.page < meta.totalPages) {
    throw new Error(`hasNext ${meta.hasNext} inconsistent with page ${meta.page} / totalPages ${meta.totalPages}`);
  }
  if (meta.hasPrev !== meta.page > 1) {
    throw new Error(`hasPrev ${meta.hasPrev} inconsistent with page ${meta.page}`);
  }
  return meta;
}

module.exports = { expectSuccess, expectError, expectPaginationMeta };
