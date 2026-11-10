'use strict';

/**
 * Process entry point: connect to MongoDB, start HTTP server, shut down gracefully.
 * All lifecycle logic lives here so app.js stays importable by tests.
 */
const http = require('http');
const createApp = require('./app');
const env = require('./config/env');
const logger = require('./config/logger');
const { connectDatabase, disconnectDatabase } = require('./config/db');

async function seedIfEnabled() {
  if (!env.seedOnStart) return;
  try {
    // Lazy require so a seeding problem can never prevent the API from booting.
    const { seedBoards, ensureAdminFromEnv } = require('./services/seedService');
    await seedBoards();
    // Idempotent: only creates the admin when ADMIN_EMAIL/ADMIN_PASSWORD are set
    // and the account does not exist yet. Never logs credentials.
    await ensureAdminFromEnv();
  } catch (error) {
    logger.warn('Database bootstrap skipped', { message: error.message });
  }
}

async function start() {
  const app = createApp();

  await connectDatabase();
  await seedIfEnabled();

  const server = http.createServer(app);
  server.keepAliveTimeout = 65_000;
  server.headersTimeout = 70_000;

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(env.port, () => {
      server.removeListener('error', reject);
      resolve();
    });
  });

  logger.info('AdiYogi API listening', {
    port: env.port,
    env: env.nodeEnv,
    apiBasePath: env.apiBasePath,
    aiConfigured: env.ai.isConfigured,
  });

  let shuttingDown = false;
  const shutdown = async (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info('Shutting down', { signal });

    const forceExit = setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 15_000);
    forceExit.unref();

    try {
      await new Promise((resolve) => server.close(resolve));
      await disconnectDatabase();
      clearTimeout(forceExit);
      logger.info('Shutdown complete');
      process.exit(0);
    } catch (error) {
      logger.error('Error during shutdown', { message: error.message });
      process.exit(1);
    }
  };

  ['SIGTERM', 'SIGINT'].forEach((signal) => process.on(signal, () => shutdown(signal)));

  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled promise rejection', {
      message: reason instanceof Error ? reason.message : String(reason),
    });
  });
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception', { message: error.message, stack: error.stack });
    shutdown('uncaughtException');
  });

  return server;
}

if (require.main === module) {
  start().catch((error) => {
    logger.error('Failed to start API', { message: error.message, stack: error.stack });
    process.exit(1);
  });
}

module.exports = { start };
