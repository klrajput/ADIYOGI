'use strict';

/**
 * Token primitives (docs/ARCHITECTURE.md §6.2, §12.2).
 * Tampering and expiry must always fail closed with the generic INVALID_ACCESS_TOKEN
 * error — never a 500 and never an error message that reveals why.
 */
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const env = require('../../src/config/env');
const {
  signAccessToken,
  verifyAccessToken,
  generateOpaqueToken,
  hashToken,
  signCsrfToken,
  verifyCsrfToken,
} = require('../../src/utils/tokens');

const VALID = { sub: '507f1f77bcf86cd799439011', kind: 'anonymous', role: 'member' };

describe('access tokens', () => {
  it('round-trips the frozen claim set', () => {
    const token = signAccessToken(VALID);
    const claims = verifyAccessToken(token);

    expect(claims).toEqual({ sub: VALID.sub, kind: 'anonymous', role: 'member' });
    // Internal claims must not leak into the contract object.
    expect(claims).not.toHaveProperty('iat');
    expect(claims).not.toHaveProperty('exp');
    expect(claims).not.toHaveProperty('iss');
    expect(token.split('.')).toHaveLength(3);
  });

  it('keeps the optional uid claim', () => {
    const token = signAccessToken({ ...VALID, kind: 'user', role: 'moderator', uid: 'user-1' });
    expect(verifyAccessToken(token)).toEqual({
      sub: VALID.sub,
      kind: 'user',
      role: 'moderator',
      uid: 'user-1',
    });
  });

  it('is an HS256 JWT with the documented issuer/audience', () => {
    const token = signAccessToken(VALID);
    const decoded = jwt.decode(token, { complete: true });
    expect(decoded.header.alg).toBe('HS256');
    expect(decoded.payload.iss).toBe('adiyogi');
    expect(decoded.payload.aud).toBe('adiyogi-web');
    expect(decoded.payload.exp - decoded.payload.iat).toBe(env.accessTokenTtlMin * 60);
  });

  it('rejects a tampered payload', () => {
    const token = signAccessToken(VALID);
    const [header, payload, signature] = token.split('.');
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    claims.role = 'admin';
    const forged = [
      header,
      Buffer.from(JSON.stringify(claims)).toString('base64url'),
      signature,
    ].join('.');

    expect(() => verifyAccessToken(forged)).toThrow(/Invalid or expired access token/);
    try {
      verifyAccessToken(forged);
    } catch (error) {
      expect(error.code).toBe('INVALID_ACCESS_TOKEN');
    }
  });

  it('rejects a token signed with a different secret', () => {
    const foreign = jwt.sign({ kind: 'anonymous', role: 'member' }, 'a-different-secret', {
      algorithm: 'HS256',
      issuer: 'adiyogi',
      audience: 'adiyogi-web',
      subject: VALID.sub,
      expiresIn: 60,
    });
    expect(() => verifyAccessToken(foreign)).toThrow();
  });

  it('rejects an expired token', () => {
    const expired = jwt.sign({ kind: 'anonymous', role: 'member' }, env.jwtSecret, {
      algorithm: 'HS256',
      issuer: 'adiyogi',
      audience: 'adiyogi-web',
      subject: VALID.sub,
      expiresIn: -10,
    });
    expect(() => verifyAccessToken(expired)).toThrow(/Invalid or expired access token/);
  });

  it('rejects tokens with the wrong issuer/audience', () => {
    const wrongAudience = jwt.sign({ kind: 'anonymous', role: 'member' }, env.jwtSecret, {
      algorithm: 'HS256',
      issuer: 'adiyogi',
      audience: 'someone-else',
      subject: VALID.sub,
      expiresIn: 60,
    });
    expect(() => verifyAccessToken(wrongAudience)).toThrow();
  });

  it('does not accept unknown kinds or roles', () => {
    const token = signAccessToken(VALID);
    const [header, payload] = token.split('.');
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    claims.role = 'superuser';
    const forged = [header, Buffer.from(JSON.stringify(claims)).toString('base64url'), token.split('.')[2]].join('.');
    expect(() => verifyAccessToken(forged)).toThrow();
  });

  it('rejects malformed / empty tokens without throwing a native TypeError', () => {
    ['', 'not-a-token', 'a.b.c', 'a.b', null, undefined, 42].forEach((value) => {
      expect(() => verifyAccessToken(value)).toThrow();
      try {
        verifyAccessToken(value);
      } catch (error) {
        expect(error.code).toBe('INVALID_ACCESS_TOKEN');
      }
    });
  });

  it('validates signing input', () => {
    expect(() => signAccessToken({})).toThrow(TypeError);
    expect(() => signAccessToken({ ...VALID, kind: 'robot' })).toThrow(TypeError);
    expect(() => signAccessToken({ ...VALID, role: 'root' })).toThrow(TypeError);
    expect(() => signAccessToken({ ...VALID, uid: '' })).toThrow(TypeError);
  });
});

describe('opaque tokens', () => {
  it('generates unique, non-guessable values', () => {
    const tokens = new Set(Array.from({ length: 200 }, () => generateOpaqueToken()));
    expect(tokens.size).toBe(200);
    tokens.forEach((token) => {
      expect(token.length).toBeGreaterThanOrEqual(32);
      expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    });
  });

  it('hashes tokens deterministically with sha256 (nothing stored in plaintext)', () => {
    const token = generateOpaqueToken();
    const digest = hashToken(token);
    expect(digest).toMatch(/^[a-f0-9]{64}$/);
    expect(digest).toBe(crypto.createHash('sha256').update(token).digest('hex'));
    expect(digest).not.toBe(token);
  });

  it('refuses to hash an empty token', () => {
    expect(() => hashToken('')).toThrow(TypeError);
    expect(() => hashToken(undefined)).toThrow(TypeError);
  });
});

describe('CSRF token signing', () => {
  it('round-trips a signed token', () => {
    const signed = signCsrfToken(generateOpaqueToken(32));
    expect(signed).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    expect(verifyCsrfToken(signed)).toBe(true);
  });

  it('rejects a tampered raw portion', () => {
    const signed = signCsrfToken('raw-token-value');
    expect(verifyCsrfToken(`other-raw.${signed.split('.')[1]}`)).toBe(false);
  });

  it('rejects a tampered MAC portion', () => {
    const signed = signCsrfToken('raw-token-value');
    const [raw, mac] = signed.split('.');
    const flipped = `${mac.slice(0, -1)}${mac.endsWith('A') ? 'B' : 'A'}`;
    expect(verifyCsrfToken(`${raw}.${flipped}`)).toBe(false);
  });

  it.each([
    ['empty', ''],
    ['no separator', 'justarawtoken'],
    ['empty mac', 'raw.'],
    ['empty raw', '.mac'],
    ['too many separators', 'a.b.c'],
    ['non-string', 123],
    ['null', null],
  ])('rejects malformed token: %s', (_label, value) => {
    expect(verifyCsrfToken(value)).toBe(false);
  });

  it('requires a raw token to sign', () => {
    expect(() => signCsrfToken('')).toThrow(TypeError);
    expect(() => signCsrfToken(undefined)).toThrow(TypeError);
  });
});
