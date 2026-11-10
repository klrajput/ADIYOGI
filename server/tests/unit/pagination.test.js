'use strict';

/**
 * Pagination utility contract (docs/ARCHITECTURE.md §4.1, §12.2).
 * Clamping must make hostile query params harmless and the meta arithmetic must be
 * internally consistent for every page of every collection.
 */
const {
  getPagination,
  buildMeta,
  DEFAULT_LIMIT,
  MAX_LIMIT,
} = require('../../src/utils/pagination');

describe('getPagination', () => {
  it('defaults to page 1 and a bounded default limit', () => {
    expect(getPagination({})).toEqual({ page: 1, limit: DEFAULT_LIMIT, skip: 0 });
    expect(getPagination()).toEqual({ page: 1, limit: DEFAULT_LIMIT, skip: 0 });
    expect(DEFAULT_LIMIT).toBe(20);
  });

  it('parses numeric strings from a query string', () => {
    expect(getPagination({ page: '3', limit: '10' })).toEqual({ page: 3, limit: 10, skip: 20 });
    expect(getPagination({ page: 2, limit: 5 })).toEqual({ page: 2, limit: 5, skip: 5 });
  });

  it.each([
    ['zero page', { page: '0' }],
    ['negative page', { page: '-4' }],
    ['non-numeric page', { page: 'abc' }],
    ['float-ish page', { page: 'not-a-page' }],
    ['non-numeric array page', { page: ['nope', 'nada'] }],
  ])('clamps %s to page 1', (_label, query) => {
    const { page } = getPagination(query);
    expect(page).toBe(1);
  });

  it.each([
    ['zero limit', { limit: '0' }],
    ['negative limit', { limit: '-10' }],
    ['non-numeric limit', { limit: 'lots' }],
    ['empty limit', { limit: '' }],
  ])('falls back to the default limit for %s', (_label, query) => {
    expect(getPagination(query).limit).toBe(DEFAULT_LIMIT);
  });

  it('clamps oversized limits to MAX_LIMIT (50)', () => {
    expect(getPagination({ limit: '1000' }).limit).toBe(MAX_LIMIT);
    expect(getPagination({ limit: '51' }).limit).toBe(50);
    expect(getPagination({ limit: '50' }).limit).toBe(50);
    expect(MAX_LIMIT).toBe(50);
  });

  it('supports per-call default and max limits (e.g. audit log page size)', () => {
    expect(getPagination({}, { defaultLimit: 5, maxLimit: 10 })).toEqual({ page: 1, limit: 5, skip: 0 });
    expect(getPagination({ limit: '99' }, { defaultLimit: 5, maxLimit: 10 }).limit).toBe(10);
  });

  it('computes skip from page and limit', () => {
    expect(getPagination({ page: '4', limit: '25' }).skip).toBe(75);
    expect(getPagination({ page: '1', limit: '50' }).skip).toBe(0);
  });
});

describe('buildMeta', () => {
  it('builds the frozen pagination block', () => {
    expect(buildMeta({ page: 1, limit: 20, total: 137 })).toEqual({
      page: 1,
      limit: 20,
      total: 137,
      totalPages: 7,
      hasNext: true,
      hasPrev: false,
    });
  });

  it('marks the last page correctly', () => {
    expect(buildMeta({ page: 7, limit: 20, total: 137 })).toEqual({
      page: 7,
      limit: 20,
      total: 137,
      totalPages: 7,
      hasNext: false,
      hasPrev: true,
    });
  });

  it('handles exact page boundaries', () => {
    const second = buildMeta({ page: 2, limit: 20, total: 40 });
    expect(second.totalPages).toBe(2);
    expect(second.hasNext).toBe(false);
    expect(second.hasPrev).toBe(true);
  });

  it('handles an empty collection', () => {
    expect(buildMeta({ page: 1, limit: 20, total: 0 })).toEqual({
      page: 1,
      limit: 20,
      total: 0,
      totalPages: 0,
      hasNext: false,
      hasPrev: false,
    });
  });

  it('treats a non-finite total as 0 instead of emitting NaN', () => {
    const meta = buildMeta({ page: 1, limit: 20, total: undefined });
    expect(meta.total).toBe(0);
    expect(meta.totalPages).toBe(0);
    expect(Number.isNaN(meta.hasNext)).toBe(false);
  });

  it('never divides by a zero limit', () => {
    const meta = buildMeta({ page: 1, limit: 0, total: 10 });
    expect(meta.totalPages).toBe(0);
    expect(meta.hasNext).toBe(false);
  });
});
