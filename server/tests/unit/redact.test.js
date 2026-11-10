'use strict';

/**
 * Privacy redaction helpers (docs/ARCHITECTURE.md §5, §12.2).
 * Raw IPs, emails and tokens must never be stored or logged; these helpers are the
 * enforcement point, so their output format is asserted exactly.
 */
const { hashIp, redactEmail, redactToken } = require('../../src/utils/redact');

describe('hashIp', () => {
  it('produces a truncated HMAC-SHA256 hex pseudonym', () => {
    const hash = hashIp('203.0.113.7');
    expect(hash).toMatch(/^[a-f0-9]{32}$/);
    expect(hash).not.toContain('203.0.113.7');
  });

  it('is deterministic for the same address', () => {
    expect(hashIp('198.51.100.23')).toBe(hashIp('198.51.100.23'));
  });

  it('differs across addresses', () => {
    expect(hashIp('198.51.100.23')).not.toBe(hashIp('198.51.100.24'));
  });

  it('normalises IPv4-mapped IPv6 and bracketed IPv6 to the same pseudonym', () => {
    expect(hashIp('::ffff:127.0.0.1')).toBe(hashIp('127.0.0.1'));
    expect(hashIp('[::1]')).toBe(hashIp('::1'));
    expect(hashIp('192.0.2.9:443')).toBe(hashIp('192.0.2.9'));
    expect(hashIp('fe80::1%en0')).toBe(hashIp('fe80::1'));
  });

  it.each([[undefined], [null], [''], ['   '], [42]])('returns "unknown" for %p', (value) => {
    expect(hashIp(value)).toBe('unknown');
  });
});

describe('redactEmail', () => {
  it('keeps the domain and first character only', () => {
    expect(redactEmail('alice@example.com')).toBe('a***@example.com');
    expect(redactEmail('bob.smith@mail.example.org')).toBe('b***@mail.example.org');
    expect(redactEmail('a@b.co')).toBe('a***@b.co');
  });

  it('does not leak the local part beyond one character', () => {
    const redacted = redactEmail('verysecretlocalpart@example.com');
    expect(redacted).not.toContain('verysecretlocalpart');
    expect(redacted).toBe('v***@example.com');
  });

  it.each([[undefined], [null], [''], ['not-an-email'], ['@example.com'], ['trailing@']])(
    'returns "***" for %p',
    (value) => {
      expect(redactEmail(value)).toBe('***');
    }
  );
});

describe('redactToken', () => {
  it('shows a short prefix plus length, enough to correlate but not reuse', () => {
    expect(redactToken('abcdefghij')).toBe('abcdef…10');
    expect(redactToken('x')).toBe('x…1');
  });

  it('does not echo the full token', () => {
    const token = 'eyJhbGciOiJIUzI1NiJ9.secret-payload.signature';
    const redacted = redactToken(token);
    expect(redacted).not.toContain('secret-payload');
    expect(redacted.length).toBeLessThan(token.length);
  });

  it.each([[undefined], [null], [''], [42], [{}]])('returns "none" for %p', (value) => {
    expect(redactToken(value)).toBe('none');
  });
});
