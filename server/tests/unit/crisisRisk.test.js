'use strict';

/**
 * Crisis risk scorer contract (docs/ARCHITECTURE.md §7, §8, §12.4).
 *
 * This is the safety-critical component of the platform: it decides whether a user sees
 * crisis resources. The table below is deliberately large and realistic — it covers
 * explicit intent, plans/means, negation, third-person disclosures, quoted lyrics,
 * ambiguous single words, distress-only text, empty input and non-English text.
 *
 * The engine is layered: the rule tier is authoritative, and (when AI is configured)
 * the classifier may only RAISE severity. No provider is configured in the test
 * environment, so these assertions are fully deterministic and offline.
 */
const {
  LEVELS,
  THRESHOLDS,
  RISK_PATTERNS,
  normalizeText,
  assess,
  getResources,
} = require('../../src/services/crisisService');

const VALID = new Set(LEVELS);

describe('risk level table — realistic disclosures', () => {
  /**
   * level expectations are contractual tiers (§7):
   *   high     = explicit intent / plan / means / self-harm / farewell
   *   elevated = hopelessness, entrapment, burden, suicidal ideation without intent
   *   low      = general distress / help-seeking / ambiguous term
   *   none     = no risk signal
   */
  const cases = [
    // ---- explicit intent / plan / means / actions ----
    ['I want to kill myself', 'high'],
    ['I am going to end my life tonight', 'high'],
    ['I have a suicide plan and I have saved up pills', 'high'],
    ['I took too many pills last night', 'high'],
    ['I overdosed', 'high'],
    ['I cut myself again last night', 'high'],
    ['I want to hurt myself', 'high'],
    ['I am about to end it', 'high'],
    ['I do not want to live anymore', 'high'],
    ['I feel like ending it all', 'high'],
    ['I am going to jump off the bridge', 'high'],
    ['I WANT TO DIE', 'high'],

    // ---- negation: a denial must not be scored as intent ----
    ["I'm not suicidal", 'none'],
    ['I am not going to kill myself, I want to live', 'none'],
    ['I have never wanted to kill myself', 'none'],

    // ---- elevated: ideation without stated intent / hopelessness ----
    ['I wish I was dead', 'elevated'],
    ['I feel hopeless', 'elevated'],
    ['I am a burden to everyone', 'elevated'],
    ['I feel trapped and there is no way out', 'elevated'],
    ['I have been feeling depressed for months', 'elevated'],
    ["I can't stop thinking about suicide", 'elevated'],
    ['I am thinking about suicide', 'elevated'],
    ['Nobody would miss me if I was gone', 'elevated'],

    // ---- low: distress / help-seeking ----
    ['I have been feeling sad and overwhelmed', 'low'],
    ['I need help, I do not know what to do', 'low'],
    ['I am not okay', 'low'],
    ['I am scared and lonely', 'low'],

    // ---- none: no risk signal ----
    ['I am fine, just tired', 'none'],
    ['I went for a walk and made tea', 'none'],

    // ---- quoted / reported speech must not be scored as the writer's intent ----
    ['The song says "kill myself"', 'low'],
    ['I was listening to lyrics: i want to die', 'low'],
    ['I watched a movie where the character killed himself', 'none'],

    // ---- third person: a real person's disclosure is a moderate concern ----
    ['My friend is suicidal and I am worried', 'elevated'],
    ['My brother has been self-harming', 'elevated'],

    // ---- empty / whitespace / non-English must not crash ----
    ['', 'none'],
    ['   ', 'none'],
    ['😊😊', 'none'],
  ];

  it.each(cases)('scores %p as %p', async (text, expected) => {
    expect(VALID.has(expected)).toBe(true);
    const result = await assess(text);

    expect(result).toEqual(
      expect.objectContaining({
        level: expected,
        showResources: expected !== 'none',
      })
    );
  });

  it.each(cases)('returns a well-formed assessment for %p', async (text) => {
    const result = await assess(text);
    expect(VALID.has(result.level)).toBe(true);
    expect(Number.isInteger(result.score)).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(Array.isArray(result.reasons)).toBe(true);
    expect(new Set(result.reasons).size).toBe(result.reasons.length);
    result.reasons.forEach((reason) => {
      expect(typeof reason).toBe('string');
      expect(reason.length).toBeLessThanOrEqual(64);
      // Reasons are stable machine codes, never echoed user text.
      if (text.trim()) expect(reason).not.toBe(text);
    });
    expect(typeof result.showResources).toBe('boolean');
  });

  it('handles non-English text without crashing (levels are still valid)', async () => {
    for (const text of ['मैं मरना चाहता हूँ', 'Ich möchte sterben', 'quiero morir', '私死にたい']) {
      const result = await assess(text);
      expect(VALID.has(result.level)).toBe(true);
      expect(Number.isInteger(result.score)).toBe(true);
    }
  });
});

describe('the isolated ambiguous word rule (§7)', () => {
  it('never returns high for one isolated ambiguous word', async () => {
    for (const word of ['die', 'dead', 'death', 'kill', 'killing', 'suicide', 'kms', 'unalive']) {
      const result = await assess(word);
      expect(result.level).not.toBe('high');
      expect(['none', 'low']).toContain(result.level);
      // An isolated ambiguous term must not surface a crisis card.
      if (result.level === 'none') expect(result.showResources).toBe(false);
    }
  });

  it('does not treat a benign figure of speech as high risk', async () => {
    const result = await assess('I could kill for a cup of coffee right now');
    expect(result.level).not.toBe('high');
    expect(result.level).not.toBe('elevated');
  });

  it('does not treat suicide-prevention education as high risk', async () => {
    const result = await assess('Today I learned about suicide prevention at a workshop');
    expect(result.level).not.toBe('high');
  });
});

describe('layered engine invariants', () => {
  it('defines the four levels in severity order', () => {
    expect(LEVELS).toEqual(['none', 'low', 'elevated', 'high']);
    expect(THRESHOLDS.low).toBeLessThan(THRESHOLDS.elevated);
    expect(THRESHOLDS.elevated).toBeLessThan(THRESHOLDS.high);
  });

  it('keeps a reviewable weighted lexicon with stable reason codes', () => {
    expect(RISK_PATTERNS.length).toBeGreaterThanOrEqual(10);
    const codes = new Set();
    RISK_PATTERNS.forEach((rule) => {
      expect(typeof rule.code).toBe('string');
      expect(rule.code).toMatch(/^[a-z_]+$/);
      expect(['none', 'low', 'elevated', 'high']).toContain(rule.level);
      expect(rule.weight).toBeGreaterThan(0);
      expect(Array.isArray(rule.patterns)).toBe(true);
      expect(codes.has(rule.code)).toBe(false);
      codes.add(rule.code);
    });
    // The tiers the contract names must exist.
    ['suicide_intent', 'suicide_plan', 'access_to_means', 'self_harm', 'farewell'].forEach((code) => {
      expect(codes.has(code)).toBe(true);
    });
  });

  it('normalises unicode punctuation and contractions before matching', () => {
    expect(normalizeText('I\u2019m NOT\u00a0okay')).toBe('i am not okay');
    expect(normalizeText('I can\u2019t stop')).toBe('i cannot stop');
    expect(normalizeText('I wanna die')).toBe('i want to die');
    expect(normalizeText('sooooo tired')).toBe('so tired');
  });

  it('matches a disclosure expressed through contractions ("wanna")', async () => {
    const result = await assess('I wanna die');
    expect(result.level).toBe('high');
  });

  it('never echoes the assessed text in the result (privacy §7)', async () => {
    const secret = 'my neighbour is called MrX and I want to kill myself';
    const result = await assess(secret);
    expect(JSON.stringify(result)).not.toContain('MrX');
    expect(result.level).toBe('high');
  });
});

describe('showResources thresholds (§8)', () => {
  it('is false for none and true for every level above none', async () => {
    expect((await assess('I am fine')).showResources).toBe(false);
    expect((await assess('I am scared')).showResources).toBe(true);
    expect((await assess('I feel hopeless')).showResources).toBe(true);
    expect((await assess('I want to kill myself')).showResources).toBe(true);
  });
});

/**
 * These assertions encode the safety-first contract for phrases the rule engine is
 * documented to cover (high-tier farewell/plan rules and the third-person heuristic).
 * They are currently failing against the implementation — reported as product bugs
 * rather than weakened here.
 */
describe('safety gaps — high-tier farewll and third-person disclosures', () => {
  it.each([
    'This is my last message to everyone',
    'This will be my final post',
    'goodbye forever',
  ])('scores an explicit farewell as high: %p', async (text) => {
    const result = await assess(text);
    expect(result.reasons).toContain('farewell');
    expect(result.level).toBe('high');
  });

  it('scores a written goodbye note as high', async () => {
    const result = await assess('I have written a goodbye note');
    expect(result.level).toBe('high');
  });

  it.each([
    'My friend wants to die',
    'My friend said he wants to die',
    'my partner told me she is suicidal',
  ])('surfaces a third-party disclosure as at least elevated: %p', async (text) => {
    const result = await assess(text);
    expect(['elevated', 'high']).toContain(result.level);
  });
});

describe('getResources (§8, §12.4)', () => {
  it('returns the frozen resource payload for a known region', () => {
    const resources = getResources({ country: 'IN' });
    expect(resources).toEqual(
      expect.objectContaining({
        region: 'IN',
        label: 'India',
        lastVerified: expect.stringMatching(/^\d{4}-\d{2}$/),
        disclaimer: expect.stringMatching(/not a crisis service/i),
      })
    );
    expect(resources.primary.contact).toBeTruthy();
    expect(resources.emergency.contact).toBeTruthy();
    expect(resources.international.url).toMatch(/findahelpline\.com/);
  });

  it('falls back to INTL for junk country input', () => {
    ['ZZ', '', undefined, null, 42, 'Narnia'].forEach((country) => {
      expect(getResources({ country }).region).toBe('INTL');
    });
  });

  it('never throws and always returns a usable primary contact', () => {
    const resources = getResources();
    expect(resources.primary.name).toBeTruthy();
    expect(resources.primary.contact).toBeTruthy();
  });
});
