'use strict';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

/**
 * Parse and clamp pagination query params.
 * @param {object} query express req.query
 * @param {{defaultLimit?:number,maxLimit?:number}} [options]
 * @returns {{page:number,limit:number,skip:number}}
 */
function getPagination(query = {}, options = {}) {
  const defaultLimit = options.defaultLimit || DEFAULT_LIMIT;
  const maxLimit = options.maxLimit || MAX_LIMIT;

  const rawPage = Number.parseInt(query.page, 10);
  const rawLimit = Number.parseInt(query.limit, 10);

  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;
  const limitCandidate = Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : defaultLimit;
  const limit = Math.min(limitCandidate, maxLimit);

  return { page, limit, skip: (page - 1) * limit };
}

/**
 * Build the `meta` pagination block.
 * @param {{page:number,limit:number,total:number}} input
 * @returns {{page:number,limit:number,total:number,totalPages:number,hasNext:boolean,hasPrev:boolean}}
 */
function buildMeta({ page, limit, total }) {
  const safeTotal = Number.isFinite(total) ? total : 0;
  const totalPages = limit > 0 ? Math.ceil(safeTotal / limit) : 0;
  return {
    page,
    limit,
    total: safeTotal,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };
}

module.exports = { getPagination, buildMeta, DEFAULT_LIMIT, MAX_LIMIT };
