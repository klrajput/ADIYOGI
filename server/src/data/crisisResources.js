'use strict';

/**
 * Verified crisis helplines — the single source of truth for the platform
 * (docs/ARCHITECTURE.md §8). The API serves this data at `GET /api/v1/crisis/resources`
 * and the frontend must fetch it, never hard-code numbers.
 *
 * Each region exposes:
 *   { code, label, primary, text?, emergency, local[], note?, verifiedOn }
 * Each helpline entry exposes:
 *   { name, contact, type: 'phone'|'text'|'chat'|'web', available, url?, verifiedOn }
 *
 * `verifiedOn` is the review date of the underlying source. Numbers change:
 * the UI must always show the disclaimer and `lastVerified`.
 *
 * AdiYogi is not a crisis service. Nothing here implies monitoring.
 */

const LAST_VERIFIED = '2026-04';

const DISCLAIMER =
  'Numbers can change; confirm locally. AdiYogi is not a crisis service and cannot monitor emergencies.';

const DEFAULT_REGION = 'INTL';

const REGION_ORDER = Object.freeze(['US', 'IN', 'GB', 'CA', 'AU', 'INTL']);

/** @type {{code:string,label:string,primary:object,text?:object,emergency:object,local:object[],note?:string,verifiedOn:string}} */
const REGIONS = {
  US: {
    code: 'US',
    label: 'United States',
    primary: {
      name: '988 Suicide & Crisis Lifeline',
      contact: '988',
      type: 'phone',
      available: '24/7 — call or text 988',
      url: 'https://988lifeline.org',
      verifiedOn: LAST_VERIFIED,
    },
    text: {
      name: 'Crisis Text Line',
      contact: 'Text HOME to 741741',
      type: 'text',
      available: '24/7',
      url: 'https://www.crisistextline.org',
      verifiedOn: LAST_VERIFIED,
    },
    emergency: {
      name: 'Emergency services',
      contact: '911',
      type: 'phone',
      available: '24/7',
      verifiedOn: LAST_VERIFIED,
    },
    local: [
      {
        name: 'Veterans Crisis Line',
        contact: '988, then press 1',
        type: 'phone',
        available: '24/7',
        url: 'https://www.veteranscrisisline.net',
        verifiedOn: LAST_VERIFIED,
      },
      {
        name: 'The Trevor Project (LGBTQ+ young people)',
        contact: '1-866-488-7386',
        type: 'phone',
        available: '24/7',
        url: 'https://www.thetrevorproject.org',
        verifiedOn: LAST_VERIFIED,
      },
    ],
    note: 'Call or text 988, or text HOME to 741741. If someone is in immediate danger, call 911.',
    verifiedOn: LAST_VERIFIED,
  },

  IN: {
    code: 'IN',
    label: 'India',
    primary: {
      name: 'KIRAN Mental Health Helpline',
      contact: '1800-599-0019',
      type: 'phone',
      available: '24/7 — toll free, multiple Indian languages',
      url: 'https://www.mohfw.gov.in',
      verifiedOn: LAST_VERIFIED,
    },
    emergency: {
      name: 'National emergency number',
      contact: '112',
      type: 'phone',
      available: '24/7',
      verifiedOn: LAST_VERIFIED,
    },
    local: [
      {
        name: 'Tele-MANAS',
        contact: '14416',
        type: 'phone',
        available: '24/7 — toll free mental health support',
        url: 'https://telemanas.mohfw.gov.in',
        verifiedOn: LAST_VERIFIED,
      },
      {
        name: 'AASRA (24-hour helpline)',
        contact: '+91-22-27546669',
        type: 'phone',
        available: '24/7',
        url: 'https://www.aasra.info',
        verifiedOn: LAST_VERIFIED,
      },
      {
        name: 'iCALL (TISS)',
        contact: '+91-9152987821',
        type: 'phone',
        available: 'Mon–Sat, 8:00–21:00 IST',
        url: 'https://icallhelpline.org',
        verifiedOn: LAST_VERIFIED,
      },
    ],
    note: 'India has no national text line. For immediate danger, call 112.',
    verifiedOn: LAST_VERIFIED,
  },

  GB: {
    code: 'GB',
    label: 'United Kingdom',
    primary: {
      name: 'Samaritans',
      contact: '116 123',
      type: 'phone',
      available: '24/7 — free, confidential',
      url: 'https://www.samaritans.org',
      verifiedOn: LAST_VERIFIED,
    },
    text: {
      name: 'Shout',
      contact: 'Text SHOUT to 85258',
      type: 'text',
      available: '24/7 — free, confidential',
      url: 'https://giveusashout.org',
      verifiedOn: LAST_VERIFIED,
    },
    emergency: {
      name: 'Emergency services',
      contact: '999',
      type: 'phone',
      available: '24/7',
      verifiedOn: LAST_VERIFIED,
    },
    local: [
      {
        name: 'NHS 111 (mental health option)',
        contact: '111',
        type: 'phone',
        available: '24/7',
        url: 'https://111.nhs.uk',
        verifiedOn: LAST_VERIFIED,
      },
    ],
    note: 'If life is at risk, call 999 or go to A&E. Samaritans is free and does not appear on phone bills.',
    verifiedOn: LAST_VERIFIED,
  },

  CA: {
    code: 'CA',
    label: 'Canada',
    primary: {
      name: '9-8-8 Suicide Crisis Helpline',
      contact: '988',
      type: 'phone',
      available: '24/7 — call or text 9-8-8',
      url: 'https://988.ca',
      verifiedOn: LAST_VERIFIED,
    },
    text: {
      name: 'Kids Help Phone',
      contact: 'Text CONNECT to 686868',
      type: 'text',
      available: '24/7 — young people up to age 29',
      url: 'https://kidshelpphone.ca',
      verifiedOn: LAST_VERIFIED,
    },
    emergency: {
      name: 'Emergency services',
      contact: '911',
      type: 'phone',
      available: '24/7',
      verifiedOn: LAST_VERIFIED,
    },
    local: [
      {
        name: 'Kids Help Phone',
        contact: '1-800-668-6868',
        type: 'phone',
        available: '24/7',
        url: 'https://kidshelpphone.ca',
        verifiedOn: LAST_VERIFIED,
      },
    ],
    note: 'If your safety is at risk, call 911. 9-8-8 is free and available 24/7/365.',
    verifiedOn: LAST_VERIFIED,
  },

  AU: {
    code: 'AU',
    label: 'Australia',
    primary: {
      name: 'Lifeline Australia',
      contact: '13 11 14',
      type: 'phone',
      available: '24/7 — crisis support',
      url: 'https://www.lifeline.org.au',
      verifiedOn: LAST_VERIFIED,
    },
    text: {
      name: 'Lifeline Text',
      contact: 'Text 0477 13 11 14',
      type: 'text',
      available: '24/7',
      url: 'https://www.lifeline.org.au/get-help/services/text',
      verifiedOn: LAST_VERIFIED,
    },
    emergency: {
      name: 'Emergency services (Triple Zero)',
      contact: '000',
      type: 'phone',
      available: '24/7',
      verifiedOn: LAST_VERIFIED,
    },
    local: [
      {
        name: 'Beyond Blue',
        contact: '1300 22 4636',
        type: 'phone',
        available: '24/7',
        url: 'https://www.beyondblue.org.au',
        verifiedOn: LAST_VERIFIED,
      },
      {
        name: 'Kids Helpline (young people 5–25)',
        contact: '1800 55 1800',
        type: 'phone',
        available: '24/7',
        url: 'https://www.kidshelpline.com.au',
        verifiedOn: LAST_VERIFIED,
      },
    ],
    note: 'If life is in danger, call Triple Zero (000). Lifeline is available 24/7 by phone, text and chat.',
    verifiedOn: LAST_VERIFIED,
  },

  INTL: {
    code: 'INTL',
    label: 'International',
    primary: {
      name: 'Find A Helpline',
      contact: 'https://findahelpline.com',
      type: 'web',
      available: '24/7 online directory of verified helplines in 175+ countries',
      url: 'https://findahelpline.com',
      verifiedOn: LAST_VERIFIED,
    },
    emergency: {
      name: 'Local emergency services',
      contact: 'Your local emergency number',
      type: 'phone',
      available: '24/7',
      verifiedOn: LAST_VERIFIED,
    },
    local: [
      {
        name: 'Befrienders Worldwide',
        contact: 'https://befrienders.org/find-support-now',
        type: 'web',
        available: 'Directory of emotional-support centres worldwide',
        url: 'https://befrienders.org',
        verifiedOn: LAST_VERIFIED,
      },
    ],
    note: 'Local numbers vary by country. Find A Helpline lists verified services for your country — confirm the number there before calling.',
    verifiedOn: LAST_VERIFIED,
  },
};

const COUNTRY_ALIASES = Object.freeze({
  us: 'US',
  usa: 'US',
  unitedstates: 'US',
  unitedstatesofamerica: 'US',
  america: 'US',
  in: 'IN',
  ind: 'IN',
  india: 'IN',
  bharat: 'IN',
  gb: 'GB',
  uk: 'GB',
  unitedkingdom: 'GB',
  greatbritain: 'GB',
  britain: 'GB',
  england: 'GB',
  scotland: 'GB',
  wales: 'GB',
  northernireland: 'GB',
  ca: 'CA',
  can: 'CA',
  canada: 'CA',
  au: 'AU',
  aus: 'AU',
  australia: 'AU',
  intl: 'INTL',
  international: 'INTL',
  global: 'INTL',
  other: 'INTL',
  unknown: 'INTL',
});

/**
 * Normalise free-form country input to a supported region code.
 * Accepts codes ('IN', 'in'), names ('India', 'United Kingdom') and a few
 * well-known aliases. Anything unrecognised (including null/undefined) → 'INTL'.
 *
 * @param {*} input
 * @returns {'US'|'IN'|'GB'|'CA'|'AU'|'INTL'}
 */
function normalizeCountry(input) {
  if (typeof input !== 'string') return DEFAULT_REGION;
  const compact = input.toLowerCase().replace(/[^a-z]/g, '');
  if (!compact) return DEFAULT_REGION;
  if (Object.prototype.hasOwnProperty.call(REGIONS, compact.toUpperCase()) && compact.length === 2) {
    return compact.toUpperCase();
  }
  return COUNTRY_ALIASES[compact] || DEFAULT_REGION;
}

/**
 * Infer a region from the request's `Accept-Language` header only.
 * IP geolocation is deliberately never used (docs/ARCHITECTURE.md §8).
 * Falls back to 'INTL' when no supported region subtag is present.
 *
 * @param {import('express').Request} req
 * @returns {'US'|'IN'|'GB'|'CA'|'AU'|'INTL'}
 */
function inferCountryFromRequest(req) {
  try {
    if (!req) return DEFAULT_REGION;
    const header =
      typeof req.get === 'function'
        ? req.get('accept-language')
        : req.headers && req.headers['accept-language'];
    if (!header || typeof header !== 'string') return DEFAULT_REGION;

    const tags = header
      .split(',')
      .map((part) => part.split(';')[0].trim())
      .filter(Boolean);

    for (const tag of tags) {
      // e.g. en-US, hi-IN, en-GB, zh-Hant-TW (script subtag ignored).
      const subtags = tag.split('-');
      if (subtags.length < 2) continue;
      const regionSubtag = subtags[subtags.length - 1];
      if (!/^[A-Za-z]{2}$/.test(regionSubtag)) continue;
      const region = normalizeCountry(regionSubtag);
      if (region !== DEFAULT_REGION) return region;
    }
    return DEFAULT_REGION;
  } catch (_error) {
    return DEFAULT_REGION;
  }
}

/**
 * Return the raw region record for a code; unknown codes get the INTL fallback.
 * @param {string} code
 * @returns {object} deep-cloned region record (safe for callers to mutate)
 */
function getRegion(code) {
  const region = REGIONS[normalizeCountry(code)] || REGIONS[DEFAULT_REGION];
  return JSON.parse(JSON.stringify(region));
}

module.exports = {
  LAST_VERIFIED,
  DISCLAIMER,
  DEFAULT_REGION,
  REGION_ORDER,
  REGIONS,
  normalizeCountry,
  inferCountryFromRequest,
  getRegion,
};
