'use strict';

/**
 * Jest setup file — runs before every test file, before modules are imported.
 * Guarantees the API can load in tests without real secrets.
 */
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-for-adiyogi-suite-0123456789';
process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'test-session-secret-for-adiyogi-suite-0123456789';
process.env.AI_API_KEY = process.env.AI_API_KEY || '';
process.env.AI_PROVIDER = process.env.AI_PROVIDER || 'gemini';
process.env.LOG_LEVEL = 'error';
process.env.SEED_ON_START = 'false';

module.exports = {};
