'use strict';

/**
 * Plain-text sanitisation helpers (docs/ARCHITECTURE.md §12.1).
 * The API stores forum content as plain text and the client renders it as text nodes,
 * so sanitisation is defence-in-depth. The critical assertion is the negative one:
 * mental-health vocabulary must NEVER be treated as spam (§12.1 comment contract).
 */
const { stripHtml, normalizeText, containsBlockedTerms, SPAM_PATTERNS } = require('../../src/middleware/sanitize');

describe('stripHtml', () => {
  it('removes tags and leaves readable text', () => {
    expect(stripHtml('<p>Hello <strong>world</strong></p>').trim()).toBe('Hello  world');
  });

  it('removes script payloads', () => {
    const stripped = stripHtml('<script>alert("xss")</script>Please help me');
    expect(stripped).not.toContain('<');
    expect(stripped).not.toContain('script');
    expect(stripped).toContain('Please help me');
  });

  it('neutralises malformed / nested tag fragments', () => {
    expect(stripHtml('<scr<script>ipt>alert(1)</scr</script>ipt>')).not.toMatch(/[<>]/);
    expect(stripHtml('<img src=x onerror=alert(1)>')).not.toMatch(/[<>]/);
  });

  it('strips bare angle brackets', () => {
    expect(stripHtml('1 < 2 > 1')).not.toMatch(/[<>]/);
  });

  it('removes control characters but keeps newlines and tabs for paragraphs', () => {
    const stripped = stripHtml('line one\u0000line two\nline three\ttabbed');
    expect(stripped).not.toContain('\u0000');
    expect(stripped).toContain('\n');
    expect(stripped).toContain('\t');
  });

  it.each([[undefined], [null], [''], [42]])('returns an empty string for %p', (value) => {
    expect(stripHtml(value)).toBe('');
  });
});

describe('normalizeText', () => {
  it('strips markup, collapses whitespace and trims', () => {
    expect(normalizeText('  <b>Hello</b>\n\n   world\t!  ')).toBe('Hello world !');
  });

  it('normalises Unicode to NFC', () => {
    const decomposed = 'e\u0301'; // e + combining acute accent
    expect(normalizeText(decomposed)).toBe('\u00e9');
  });

  it('returns an empty string for junk input', () => {
    expect(normalizeText(undefined)).toBe('');
    expect(normalizeText(null)).toBe('');
    expect(normalizeText('   ')).toBe('');
  });
});

describe('containsBlockedTerms — spam detection', () => {
  it.each([
    'Click here to win a prize',
    'Free crypto giveaway',
    'Guaranteed returns on your investment',
    'DM me on telegram for details',
    'Work from home and make money fast',
    'BUY NOW limited offer',
  ])('flags explicit spam: %s', (text) => {
    expect(containsBlockedTerms(text)).toBe(true);
  });

  it('flags a link flood', () => {
    expect(
      containsBlockedTerms('see http://a.example http://b.example http://c.example http://d.example')
    ).toBe(true);
  });

  it('flags the same word repeated six or more times', () => {
    expect(containsBlockedTerms('help help help help help help')).toBe(true);
  });

  it('does not flag normal community writing', () => {
    [
      'I have been feeling overwhelmed and lonely this week.',
      'Thank you for sharing, I hope tomorrow is a little easier.',
      'Has anyone tried journaling before bed?',
      'I visited my GP and we talked about options.',
      'The weather was grey but I went for a walk anyway.',
    ].forEach((text) => {
      expect(containsBlockedTerms(text)).toBe(false);
    });
  });

  /**
   * CRITICAL: flagging a crisis disclosure as spam is a direct user-harm failure.
   * These must never be blocked by the spam denylist; human moderation handles abuse.
   */
  it.each([
    'I want to kill myself',
    'I am suicidal and scared',
    'I think about suicide every day',
    'I have been self-harming again',
    'my trauma is too much to carry',
    'I was abused as a child',
    'I am depressed and cannot get out of bed',
    'I cannot afford money for my medication',
    'I lost money and now I cannot pay rent',
    'my bitcoin investment lost everything and I want to die',
    'I want to buy myself some time to think',
  ])('never blocks crisis or ordinary vocabulary: %s', (text) => {
    expect(containsBlockedTerms(text)).toBe(false);
  });

  it('returns false for empty input', () => {
    expect(containsBlockedTerms(undefined)).toBe(false);
    expect(containsBlockedTerms(null)).toBe(false);
    expect(containsBlockedTerms('')).toBe(false);
    expect(containsBlockedTerms('   ')).toBe(false);
  });

  it('exposes the pattern list for inspection (no mental-health terms inside)', () => {
    expect(Array.isArray(SPAM_PATTERNS)).toBe(true);
    const sources = SPAM_PATTERNS.map((pattern) => pattern.source).join(' ');
    ['suicid', 'self-harm', 'trauma', 'abus', 'depress', 'kill'].forEach((term) => {
      expect(sources.toLowerCase()).not.toContain(term);
    });
  });
});
