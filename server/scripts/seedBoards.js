#!/usr/bin/env node
'use strict';

/**
 * Seed the board catalogue and optionally bootstrap the admin account.
 *
 * Usage (from server/):
 *   npm run seed
 *   node scripts/seedBoards.js
 *
 * Requires MONGODB_URI (and JWT_SECRET/SESSION_SECRET outside NODE_ENV=test), read from the
 * repository root `.env`. Safe to run repeatedly — see services/seedService.js.
 * Exits with code 1 on any failure.
 */
const env = require('../src/config/env');
const { connectDatabase, disconnectDatabase } = require('../src/config/db');
const { seedBoards, ensureAdminFromEnv } = require('../src/services/seedService');

/**
 * @param {string} label
 * @param {object} summary
 */
function printSummary(label, summary) {
  const details = Object.entries(summary)
    .map(([key, value]) => `${key}=${value}`)
    .join(' ');
  console.log(`${label}: ${details}`);
}

async function main() {
  await connectDatabase();
  console.log(`Connected to MongoDB database "${env.mongoDbName}".`);

  const boardSummary = await seedBoards();
  printSummary('Boards', boardSummary);

  const adminSummary = await ensureAdminFromEnv();
  printSummary('Admin bootstrap', adminSummary);
}

main()
  .catch((error) => {
    console.error(`Seeding failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(() => {
    disconnectDatabase().catch((error) => {
      console.error(`Disconnect failed: ${error.message}`);
      process.exitCode = 1;
    });
  });
