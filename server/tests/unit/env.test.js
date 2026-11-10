'use strict';

/**
 * Environment configuration contract (docs/ARCHITECTURE.md §9, §12.3).
 * Tests assert the frozen config shape the rest of the server imports, and that
 * validation fails fast on unusable configuration.
 */
const env = require('../../src/config/env');

describe('config shape', () => {
  it('exposes every documented key (§12.3)', () => {
    [
      'nodeEnv',
      'isProd',
      'isTest',
      'port',
      'apiBasePath',
      'mongoUri',
      'mongoDbName',
      'clientUrl',
      'corsOrigins',
      'jwtSecret',
      'sessionSecret',
      'accessTokenTtlMin',
      'sessionTtlDays',
      'cookieDomain',
      'cookieSecure',
      'ai',
      'retention',
      'rateLimits',
      'seedOnStart',
      'adminEmail',
      'adminPassword',
    ].forEach((key) => {
      expect(env).toHaveProperty(key);
    });
  });

  it('runs under NODE_ENV=test with safe cookie defaults', () => {
    expect(env.isTest).toBe(true);
    expect(env.isProd).toBe(false);
    expect(env.cookieSecure).toBe(false);
    expect(env.apiBasePath).toBe('/api/v1');
  });

  it('parses the CORS allow-list as a de-duplicated array', () => {
    expect(Array.isArray(env.corsOrigins)).toBe(true);
    expect(env.corsOrigins.length).toBeGreaterThan(0);
    expect(new Set(env.corsOrigins).size).toBe(env.corsOrigins.length);
    expect(env.corsOrigins).toContain(env.clientUrl);
  });

  it('reports AI as unconfigured when no API key is present', () => {
    expect(env.ai.isConfigured).toBe(false);
    expect(env.ai.apiKey).toBe('');
  });

  it('exposes privacy retention windows', () => {
    expect(env.retention.chatDays).toBe(30);
    expect(env.retention.crisisDays).toBe(90);
  });

  it('exposes the abuse-prevention rate limits', () => {
    expect(env.rateLimits.windowMinutes).toBe(15);
    expect(env.rateLimits.globalMax).toBe(300);
    expect(env.rateLimits.chatMax).toBe(20);
  });
});

describe('loadConfig validation', () => {
  it('applies overrides', () => {
    const loaded = env.loadConfig({ apiBasePath: '/api/v2', accessTokenTtlMin: 5 });
    expect(loaded.apiBasePath).toBe('/api/v2');
    expect(loaded.accessTokenTtlMin).toBe(5);
  });

  it('fails fast when the database URI is missing', () => {
    expect(() => env.loadConfig({ mongoUri: '' })).toThrow(/MONGODB_URI/);
  });

  it('never leaks secrets through the error message', () => {
    try {
      env.loadConfig({ mongoUri: '' });
      throw new Error('expected loadConfig to throw');
    } catch (error) {
      expect(error.message).not.toContain(env.jwtSecret);
      expect(error.message).not.toContain(env.sessionSecret);
    }
  });
});
