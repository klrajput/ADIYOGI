const mongoose = require('mongoose');
const logger = require('../utils/logger');

// Use MongoDB Atlas (cloud) or local MongoDB
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/mental_health_db';

async function connectDatabase() {
  try {
    await mongoose.connect(MONGODB_URI);
    logger.info('MongoDB connected successfully');
    return true;
  } catch (error) {
    logger.error('MongoDB connection failed:', error);
    return false;
  }
}

module.exports = { connectDatabase, mongoose };
