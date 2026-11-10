'use strict';

/**
 * Barrel for all Mongoose models (convenience only — per-file requires such as
 * `require('../models/User')` are equally supported and preferred by controllers).
 */
module.exports = {
  User: require('./User'),
  Session: require('./Session'),
  UserPreference: require('./UserPreference'),
  Board: require('./Board'),
  Thread: require('./Thread'),
  Reply: require('./Reply'),
  Conversation: require('./Conversation'),
  ChatMessage: require('./ChatMessage'),
  CrisisEvent: require('./CrisisEvent'),
  Report: require('./Report'),
  ModerationAction: require('./ModerationAction'),
  Notification: require('./Notification'),
};
