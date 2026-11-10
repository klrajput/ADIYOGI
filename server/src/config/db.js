'use strict';

/**
 * MongoDB connection management (ARCHITECTURE §12.3).
 *
 * Responsibilities:
 *  - create a pooled Mongoose connection (max 10 sockets, no idle floor);
 *  - retry the *initial* connection with bounded exponential backoff;
 *  - keep the process alive on transient disconnects (driver-level reconnect);
 *  - expose a small state machine for readiness probes: 'connected'|'disconnected'|'connecting';
 *  - log lifecycle events through the structured logger WITHOUT ever logging credentials,
 *    query strings or a URI that contains a password.
 */
const mongoose = require('mongoose');
const env = require('./env');
const logger = require('./logger');

const CONNECT_ATTEMPTS = 3;
const BASE_RETRY_DELAY_MS = 500;
const MAX_RETRY_DELAY_MS = 4_000;
const DEFAULT_SERVER_SELECTION_TIMEOUT_MS = 10_000;
const DEFAULT_SOCKET_TIMEOUT_MS = 45_000;
const DEFAULT_CONNECT_TIMEOUT_MS = 10_000;

/**
 * Ensure every registered model's indexes exist before accepting traffic.
 *
 * Correctness (not just performance) depends on this: the unique
 * (targetType,targetId,reportedBy) index is what makes duplicate reports impossible, and the
 * TTL indexes are what enforce chat/crisis retention. Mongoose builds them lazily and
 * asynchronously, so a fresh deployment could accept duplicates in the window before the
 * build finishes. Failures are logged but never block startup (a missing index degrades
 * guarantees, it should not take the service down).
 * @returns {Promise<void>}
 */
async function ensureIndexes() {
  const modelNames = mongoose.modelNames();
  if (modelNames.length === 0) return;

  const startedAt = Date.now();
  const results = await Promise.all(
    modelNames.map(async (name) => {
      try {
        await mongoose.model(name).init();
        return { name, ok: true };
      } catch (error) {
        logger.error('Index build failed for model', { model: name, message: error.message });
        return { name, ok: false };
      }
    })
  );

  const failed = results.filter((result) => !result.ok).map((result) => result.name);
  logger.info('Model indexes ensured', {
    models: modelNames.length,
    failed: failed.length,
    durationMs: Date.now() - startedAt,
  });
}

/** In-flight connection attempt shared by concurrent callers (server boot + tests). */
let connectPromise = null;
let listenersAttached = false;

/**
 * Remove credentials from a MongoDB URI before it is logged.
 * `mongodb+srv://user:secret@host/db` → `mongodb+srv://***:***@host/db`.
 * @param {string} uri
 * @returns {string}
 */
function sanitizeMongoUri(uri) {
  return String(uri || '').replace(
    /^(mongodb(?:\+srv)?:\/\/)(?:[^@/]+@)/,
    '$1***:***@'
  );
}

/**
 * Whether the connection string already selects a database.
 * `mongodb://host:27017/adiyogi` → true, `mongodb://host:27017/` → false.
 * @param {string} uri
 * @returns {boolean}
 */
function hasDatabaseName(uri) {
  const withoutQuery = String(uri || '').split('?')[0];
  const afterScheme = withoutQuery.replace(/^mongodb(?:\+srv)?:\/\//, '');
  const slashIndex = afterScheme.indexOf('/');
  return slashIndex !== -1 && afterScheme.slice(slashIndex + 1).length > 0;
}

/**
 * Connection options. The URI's own database name always wins; `MONGODB_DB_NAME`
 * only fills the gap for URIs such as mongodb-memory-server's empty-path URI.
 * @param {string} uri
 * @param {object} [overrides] test/deployment overrides
 * @returns {object}
 */
function buildConnectionOptions(uri, overrides = {}) {
  const options = {
    maxPoolSize: 10,
    minPoolSize: 0,
    serverSelectionTimeoutMS: DEFAULT_SERVER_SELECTION_TIMEOUT_MS,
    socketTimeoutMS: DEFAULT_SOCKET_TIMEOUT_MS,
    connectTimeoutMS: DEFAULT_CONNECT_TIMEOUT_MS,
  };
  if (!hasDatabaseName(uri) && env.mongoDbName) options.dbName = env.mongoDbName;
  return { ...options, ...overrides };
}

/** Attach lifecycle listeners exactly once per process. */
function attachConnectionListeners() {
  if (listenersAttached) return;
  listenersAttached = true;

  const connection = mongoose.connection;
  connection.on('connected', () => {
    logger.info('MongoDB connected', { dbName: connection.name });
  });
  connection.on('disconnected', () => {
    logger.warn('MongoDB disconnected');
  });
  connection.on('reconnected', () => {
    logger.info('MongoDB reconnected', { dbName: connection.name });
  });
  connection.on('error', (error) => {
    // Driver errors never include credentials; log the message only.
    logger.error('MongoDB connection error', { message: error.message });
  });
}

/**
 * @param {number} ms
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    // Do not keep the process alive just for a retry pause.
    if (typeof timer.unref === 'function') timer.unref();
  });
}

/**
 * Connect to MongoDB, retrying the initial connection with bounded exponential backoff.
 * Concurrent calls share one attempt, so early health checks cannot open extra pools.
 *
 * @param {string} [uri] explicit URI (required by tests using mongodb-memory-server)
 * @param {object} [options] connection option overrides (tests may shorten timeouts)
 * @returns {Promise<import('mongoose').Connection>}
 */
async function connectDatabase(uri = env.mongoUri, options = {}) {
  if (!uri) throw new Error('MongoDB connection URI is required');

  if (mongoose.connection.readyState === 1) return mongoose.connection;
  if (connectPromise) return connectPromise;

  attachConnectionListeners();
  const connectOptions = buildConnectionOptions(uri, options);

  connectPromise = (async () => {
    let lastError;
    for (let attempt = 1; attempt <= CONNECT_ATTEMPTS; attempt += 1) {
      try {
        logger.info('Connecting to MongoDB', {
          attempt,
          attempts: CONNECT_ATTEMPTS,
          uri: sanitizeMongoUri(uri),
        });
        await mongoose.connect(uri, connectOptions);
        logger.info('MongoDB connection established', { dbName: mongoose.connection.name });
        await ensureIndexes();
        return mongoose.connection;
      } catch (error) {
        lastError = error;
        logger.warn('MongoDB connection attempt failed', {
          attempt,
          attempts: CONNECT_ATTEMPTS,
          message: error.message,
        });
        if (attempt < CONNECT_ATTEMPTS) {
          const delay = Math.min(BASE_RETRY_DELAY_MS * 2 ** (attempt - 1), MAX_RETRY_DELAY_MS);
          const jitter = Math.floor(Math.random() * 100);
          await sleep(delay + jitter);
        }
      }
    }
    logger.error('MongoDB connection failed after retries', {
      attempts: CONNECT_ATTEMPTS,
      message: lastError ? lastError.message : 'unknown error',
    });
    throw lastError;
  })();

  try {
    return await connectPromise;
  } finally {
    connectPromise = null;
  }
}

/**
 * Close the primary connection (graceful shutdown, test teardown).
 * Safe to call when never connected.
 * @returns {Promise<void>}
 */
async function disconnectDatabase() {
  if (mongoose.connection.readyState === 0) return;
  await mongoose.disconnect();
}

/**
 * Coarse connection state for readiness probes (`/health/ready`).
 * `disconnecting` is reported as 'disconnected' because the connection is no longer usable.
 * @returns {'connected'|'disconnected'|'connecting'}
 */
function getDbState() {
  switch (mongoose.connection.readyState) {
    case 1:
      return 'connected';
    case 2:
      return 'connecting';
    default:
      return 'disconnected';
  }
}

module.exports = {
  connectDatabase,
  disconnectDatabase,
  getDbState,
  ensureIndexes,
};
