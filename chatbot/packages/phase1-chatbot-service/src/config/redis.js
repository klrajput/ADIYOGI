const redis = require('redis');
const logger = require('../utils/logger');

let client;

async function connectRedis() {
  try {
    client = redis.createClient({
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379
    });

    client.on('error', (err) => {
      logger.error('Redis error:', err);
    });

    client.on('connect', () => {
      logger.info('Redis connected successfully');
    });

    await client.connect();
  } catch (error) {
    logger.error('Redis connection failed:', error);
    throw error;
  }
}

module.exports = { client, connectRedis };
