'use strict';

/**
 * Central environment configuration.
 * Loads `.env` from the repository root (falling back to server/.env), validates it,
 * and exposes a frozen config object. Fails fast outside tests when required values
 * are missing so a misconfigured deployment never starts silently.
 */
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

const rootEnv = path.resolve(__dirname, '../../../.env');
const localEnv = path.resolve(__dirname, '../../.env');
if (fs.existsSync(rootEnv)) {
  dotenv.config({ path: rootEnv });
} else if (fs.existsSync(localEnv)) {
  dotenv.config({ path: localEnv });
}

const NODE_ENV = process.env.NODE_ENV || 'development';
const isProd = NODE_ENV === 'production';
const isTest = NODE_ENV === 'test';
const isDev = !isProd && !isTest;

function toInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toBool(value, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

function toList(value) {
  return String(value || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
const corsOrigins = Array.from(
  new Set([clientUrl, ...toList(process.env.CLIENT_URLS)].filter(Boolean))
);

const cookieSecure = isProd || toBool(process.env.COOKIE_SECURE, false);

const config = {
  nodeEnv: NODE_ENV,
  isProd,
  isDev,
  isTest,
  port: toInt(process.env.PORT, 4000),
  apiBasePath: process.env.API_BASE_PATH || '/api/v1',
  logLevel: process.env.LOG_LEVEL || (isTest ? 'error' : 'info'),

  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/adiyogi',
  mongoDbName: process.env.MONGODB_DB_NAME || 'adiyogi',

  clientUrl,
  corsOrigins,

  jwtSecret: process.env.JWT_SECRET || '',
  sessionSecret: process.env.SESSION_SECRET || '',
  accessTokenTtlMin: toInt(process.env.ACCESS_TOKEN_TTL_MIN, 15),
  sessionTtlDays: toInt(process.env.SESSION_TTL_DAYS, 30),
  cookieDomain: process.env.COOKIE_DOMAIN || undefined,
  cookieSecure,
  cookieSameSite: (process.env.COOKIE_SAMESITE || 'lax').toLowerCase() === 'none' ? 'none' : 'lax',

  ai: {
    provider: (process.env.AI_PROVIDER || 'gemini').toLowerCase(),
    apiKey: process.env.AI_API_KEY || process.env.GEMINI_API_KEY || '',
    model: process.env.AI_MODEL || 'gemini-2.0-flash',
    timeoutMs: toInt(process.env.AI_TIMEOUT_MS, 20000),
    fallbackGuided: toBool(process.env.AI_FALLBACK_GUIDED, true),
    get isConfigured() {
      return Boolean(config.ai.apiKey) && config.ai.provider !== 'none';
    },
  },

  retention: {
    chatDays: toInt(process.env.CHAT_RETENTION_DAYS, 30),
    crisisDays: toInt(process.env.CRISIS_EVENT_RETENTION_DAYS, 90),
  },

  rateLimits: {
    windowMinutes: toInt(process.env.RATE_LIMIT_WINDOW_MIN, 15),
    globalMax: toInt(process.env.RATE_LIMIT_MAX, 300),
    chatMax: toInt(process.env.CHAT_RATE_LIMIT_MAX, 20),
  },

  seedOnStart: toBool(process.env.SEED_ON_START, true),
  adminEmail: (process.env.ADMIN_EMAIL || '').trim().toLowerCase(),
  adminPassword: process.env.ADMIN_PASSWORD || '',

  appName: 'AdiYogi',
  version: require('../../package.json').version,
};

/**
 * @param {object} [overrides] - test-only overrides
 * @returns {object} validated config
 */
function loadConfig(overrides = {}) {
  const merged = { ...config, ...overrides };
  const problems = [];

  const secretMinLength = isTest ? 1 : 16;
  if (!isTest && !merged.jwtSecret) problems.push('JWT_SECRET is required');
  if (merged.jwtSecret && merged.jwtSecret.length < secretMinLength) {
    problems.push(`JWT_SECRET must be at least ${secretMinLength} characters`);
  }
  if (!isTest && !merged.sessionSecret) problems.push('SESSION_SECRET is required');
  if (merged.sessionSecret && merged.sessionSecret.length < secretMinLength) {
    problems.push(`SESSION_SECRET must be at least ${secretMinLength} characters`);
  }
  if (!merged.mongoUri) problems.push('MONGODB_URI is required');
  if (isProd && merged.corsOrigins.some((origin) => origin.includes('localhost'))) {
    problems.push('CLIENT_URL must not point at localhost in production');
  }

  if (problems.length > 0) {
    throw new Error(`Invalid environment configuration:\n - ${problems.join('\n - ')}`);
  }

  return merged;
}

const loaded = loadConfig();

module.exports = loaded;
module.exports.loadConfig = loadConfig;
module.exports.config = loaded;
