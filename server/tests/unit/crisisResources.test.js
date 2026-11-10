'use strict';

/**
 * Crisis resources data contract (docs/ARCHITECTURE.md §8).
 * The API is the single source of truth for helplines; these assertions protect the
 * region coverage, the documented entry shape and the "safe fallback" behaviour.
 */
const {
  REGIONS,
  REGION_ORDER,
  DEFAULT_REGION,
  DISCLAIMER,
  LAST_VERIFIED,
  normalizeCountry,
  inferCountryFromRequest,
  getRegion,
} = require('../../src/data/crisisResources');

describe('region coverage', () => {
  it('serves US, IN, GB, CA, AU plus an INTL fallback', () => {
    expect(REGION_ORDER).toEqual(['US', 'IN', 'GB', 'CA', 'AU', 'INTL']);
    expect(Object.keys(REGIONS).sort()).toEqual(['AU', 'CA', 'GB', 'IN', 'INTL', 'US']);
    expect(DEFAULT_REGION).toBe('INTL');
  });

  it('every region has a primary helpline, emergency number and metadata', () => {
    REGION_ORDER.forEach((code) => {
      const region = REGIONS[code];
      expect(region.code).toBe(code);
      expect(region.label.length).toBeGreaterThan(0);
      expect(region.primary).toBeTruthy();
      expect(region.emergency).toBeTruthy();
      expect(region.verifiedOn).toBe(LAST_VERIFIED);
    });
  });

  it('every helpline entry has the documented shape (§8)', () => {
    const entries = REGION_ORDER.flatMap((code) => {
      const region = REGIONS[code];
      return [region.primary, region.text, region.emergency, ...(region.local || [])].filter(Boolean);
    });
    expect(entries.length).toBeGreaterThan(10);
    entries.forEach((entry) => {
      expect(typeof entry.name).toBe('string');
      expect(entry.name.length).toBeGreaterThan(0);
      expect(typeof entry.contact).toBe('string');
      expect(entry.contact.length).toBeGreaterThan(0);
      expect(['phone', 'text', 'chat', 'web']).toContain(entry.type);
      expect(typeof entry.available).toBe('string');
      expect(entry.verifiedOn).toMatch(/^\d{4}-\d{2}$/);
      if (entry.url) expect(entry.url).toMatch(/^https:\/\//);
    });
  });

  it('the INTL fallback points at findahelpline.com', () => {
    const intl = REGIONS.INTL;
    const contacts = [intl.primary, ...(intl.local || [])].map((entry) => `${entry.url || ''} ${entry.contact}`);
    expect(contacts.join(' ')).toMatch(/findahelpline\.com/i);
  });

  it('ships the "numbers can change / not a crisis service" disclaimer', () => {
    expect(DISCLAIMER).toMatch(/confirm/i);
    expect(DISCLAIMER).toMatch(/not a crisis service/i);
  });
});

describe('normalizeCountry', () => {
  it.each([
    ['US', 'US'],
    ['us', 'US'],
    ['usa', 'US'],
    ['United States', 'US'],
    ['America', 'US'],
    ['IN', 'IN'],
    ['in', 'IN'],
    ['India', 'IN'],
    ['Bharat', 'IN'],
    ['GB', 'GB'],
    ['uk', 'GB'],
    ['United Kingdom', 'GB'],
    ['England', 'GB'],
    ['CA', 'CA'],
    ['Canada', 'CA'],
    ['AU', 'AU'],
    ['Australia', 'AU'],
    ['INTL', 'INTL'],
    ['International', 'INTL'],
    ['  India  ', 'IN'],
  ])('normalises %p to %p', (input, expected) => {
    expect(normalizeCountry(input)).toBe(expected);
  });

  it.each([['ZZ'], ['Narnia'], [''], ['   '], ['1234'], [null], [undefined], [42], [{}], [[]]])(
    'falls back safely to INTL for %p',
    (input) => {
      expect(normalizeCountry(input)).toBe('INTL');
    }
  );
});

describe('inferCountryFromRequest', () => {
  function requestWith(acceptLanguage) {
    return {
      get: (name) => (String(name).toLowerCase() === 'accept-language' ? acceptLanguage : undefined),
      headers: { 'accept-language': acceptLanguage },
    };
  }

  it.each([
    ['en-US,en;q=0.9', 'US'],
    ['hi-IN,en;q=0.8', 'IN'],
    ['en-GB,en;q=0.9', 'GB'],
    ['en-CA,fr;q=0.8', 'CA'],
    ['en-AU,en;q=0.9', 'AU'],
  ])('infers %p → %p', (header, expected) => {
    expect(inferCountryFromRequest(requestWith(header))).toBe(expected);
  });

  it('falls back to INTL when no supported region subtag is present', () => {
    expect(inferCountryFromRequest(requestWith('en'))).toBe('INTL');
    expect(inferCountryFromRequest(requestWith('*'))).toBe('INTL');
    expect(inferCountryFromRequest(requestWith('zz-ZZ'))).toBe('INTL');
  });

  it('never throws on malformed or missing headers', () => {
    expect(inferCountryFromRequest(undefined)).toBe('INTL');
    expect(inferCountryFromRequest({})).toBe('INTL');
    expect(inferCountryFromRequest({ get: () => undefined, headers: {} })).toBe('INTL');
    expect(inferCountryFromRequest(requestWith(''))).toBe('INTL');
    expect(inferCountryFromRequest(requestWith(';;;;'))).toBe('INTL');
  });

  it('does not use the client IP (only Accept-Language, §8)', () => {
    const req = {
      ip: '203.0.113.9',
      get: () => undefined,
      headers: { 'accept-language': 'en' },
    };
    expect(inferCountryFromRequest(req)).toBe('INTL');
  });
});

describe('getRegion', () => {
  it('returns a cloned region so callers cannot mutate the source of truth', () => {
    const region = getRegion('IN');
    expect(region.code).toBe('IN');
    region.label = 'mutated';
    expect(REGIONS.IN.label).not.toBe('mutated');
    expect(REGIONS.IN.label).toBe('India');
  });

  it('falls back to INTL for unknown input', () => {
    expect(getRegion('ZZ').code).toBe('INTL');
    expect(getRegion(undefined).code).toBe('INTL');
  });

  it('includes a lastVerified value for the API response', () => {
    expect(getRegion('US').verifiedOn).toMatch(/^\d{4}-\d{2}$/);
  });
});
