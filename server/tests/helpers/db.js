'use strict';

/**
 * MongoDB test harness.
 *
 * Every test file that needs persistence starts ONE in-memory MongoDB instance in
 * `beforeAll` (see tests/integration/*.test.js), connects the real application's
 * database layer to it, and stops it in `afterAll`. No test ever touches a real
 * MongoDB server or the network.
 *
 * The mongodb-memory-server binary cache is redirected into the OS temp directory:
 * the CI/sandbox home directory is read-only, and caching under the repository would
 * pollute the working tree. The first run downloads the binary once (~100 MB) and
 * subsequent runs reuse it, so the whole suite stays fast.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

/**
 * Pick the binary cache directory BEFORE `mongodb-memory-server` resolves its config.
 * Preference order:
 *   1. explicit MONGOMS_DOWNLOAD_DIR (CI may pre-seed a cache);
 *   2. the repo-local `node_modules/.cache/mongodb-memory-server` (survives between runs,
 *      gitignored, and already warm in this workspace);
 *   3. the OS temp directory.
 */
const repoCacheDir = path.resolve(__dirname, '../../../node_modules/.cache/mongodb-memory-server');
const tempCacheDir = path.join(os.tmpdir(), 'adiyogi-mongodb-binaries');
process.env.MONGOMS_DOWNLOAD_DIR =
  process.env.MONGOMS_DOWNLOAD_DIR || (fs.existsSync(repoCacheDir) ? repoCacheDir : tempCacheDir);
process.env.MONGOMS_DISABLE_POSTINSTALL = process.env.MONGOMS_DISABLE_POSTINSTALL || '1';

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const database = require('../../src/config/db');

/** @type {import('mongodb-memory-server').MongoMemoryServer|null} */
let mongo = null;
/** @type {string|null} */
let uri = null;

/**
 * Start an in-memory MongoDB and connect the application's Mongoose layer to it.
 * Idempotent: repeated calls in one process reuse the same server.
 * @returns {Promise<string>} connection URI
 */
async function startDatabase() {
  if (mongo && uri) return uri;

  mongo = await MongoMemoryServer.create({ instance: { dbName: 'adiyogi_test' } });
  uri = mongo.getUri('adiyogi_test');

  // The application db module is the unit under test in integration tests, so use it
  // rather than connecting a second, unrelated Mongoose connection.
  await database.connectDatabase(uri);

  return uri;
}

/**
 * Disconnect Mongoose and stop the in-memory server. Safe to call twice.
 * @returns {Promise<void>}
 */
async function stopDatabase() {
  try {
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.dropDatabase();
    }
  } catch {
    // Best effort: the server may already be gone.
  }

  try {
    if (typeof database.disconnectDatabase === 'function') {
      await database.disconnectDatabase();
    }
  } catch {
    // Fall through to a hard disconnect below.
  }

  if (mongoose.connection.readyState !== 0) {
    try {
      await mongoose.disconnect();
    } catch {
      // Nothing else to clean up.
    }
  }

  if (mongo) {
    await mongo.stop();
    mongo = null;
    uri = null;
  }
}

/**
 * Delete every document in every collection without dropping indexes.
 * @returns {Promise<void>}
 */
async function clearDatabase() {
  if (mongoose.connection.readyState !== 1) return;
  const nativeDb = mongoose.connection.db;
  if (!nativeDb) return;

  const collections = await nativeDb.collections();
  await Promise.all(
    collections.map(async (collection) => {
      try {
        await collection.deleteMany({});
      } catch {
        // Collections created concurrently (e.g. TTL index builds) may vanish first.
      }
    })
  );
}

/**
 * Raw native driver collection, for schema-level assertions (e.g. "a crisis event has
 * no message text field") and deletion cascade checks. Bypasses Mongoose casting and
 * toPublicJSON so tests can prove what is *really* stored.
 * @param {string} name collection name
 * @returns {import('mongodb').Collection}
 */
function collection(name) {
  if (mongoose.connection.readyState !== 1 || !mongoose.connection.db) {
    throw new Error('MongoDB is not connected: call startDatabase() first');
  }
  return mongoose.connection.db.collection(name);
}

/**
 * Count documents in a raw collection.
 * @param {string} name
 * @param {object} [filter]
 * @returns {Promise<number>}
 */
function countDocuments(name, filter = {}) {
  return collection(name).countDocuments(filter);
}

/**
 * Read raw documents (Mongoose schemas are bypassed on purpose).
 * @param {string} name
 * @param {object} [filter]
 * @param {object} [options] find options (projection, sort, limit…)
 * @returns {Promise<object[]>}
 */
function findRaw(name, filter = {}, options = {}) {
  return collection(name).find(filter, options).toArray();
}

/**
 * List collection names that currently exist.
 * @returns {Promise<string[]>}
 */
async function collectionNames() {
  const nativeDb = mongoose.connection.db;
  if (!nativeDb) return [];
  const infos = await nativeDb.listCollections().toArray();
  return infos.map((info) => info.name).sort();
}

module.exports = {
  startDatabase,
  stopDatabase,
  clearDatabase,
  collection,
  countDocuments,
  findRaw,
  collectionNames,
};
