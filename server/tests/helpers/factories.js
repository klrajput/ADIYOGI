'use strict';

/**
 * Test data factories.
 *
 * Two flavours:
 *  - pure payload builders (`threadPayload`, `replyPayload`, …) for API-driven tests,
 *    so integration tests create data the same way a browser would;
 *  - direct model inserts (`createUserRecord`, `createBoardRecord`, …) only where an
 *    API cannot reasonably be used (accounts with elevated roles, legacy/hidden data,
 *    DB-level assertions).
 *
 * Model loading is lazy so this module is importable even while the feature modules
 * are still being written; a missing model surfaces as one clear error in the test
 * that actually needs it.
 */
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

/** Password used for generated accounts: long, mixed, not a known value. */
const DEFAULT_PASSWORD = 'AdiYogi-Test-Passw0rd!';

/**
 * @returns {string} unique-enough test email (Mailinator-style, never real)
 */
function uniqueEmail(prefix = 'user') {
  return `${prefix}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}@example.test`;
}

/**
 * Load a Mongoose model by name, tolerating the models/index.js barrel existing or not.
 * @param {string} name e.g. 'User'
 * @returns {import('mongoose').Model}
 */
function model(name) {
  /** @type {Record<string, import('mongoose').Model>} */
  let barrel = {};
  try {
    // eslint-disable-next-line global-require
    barrel = require('../../src/models');
  } catch {
    barrel = {};
  }
  if (barrel && barrel[name]) return barrel[name];

  try {
    // eslint-disable-next-line global-require
    const direct = require(`../../src/models/${name}`);
    return direct && direct.default ? direct.default : direct;
  } catch (error) {
    throw new Error(`Model "${name}" could not be loaded: ${error.message}`);
  }
}

/**
 * Create an account row directly (password hashed with the production bcrypt cost).
 * The User model never returns `passwordHash` by default; this factory sets it.
 * @param {{role?:'member'|'moderator'|'admin', email?:string, password?:string, displayName?:string, status?:'active'|'suspended'}} [options]
 * @returns {Promise<{user:object, email:string, password:string, role:string}>}
 */
async function createUserRecord(options = {}) {
  const User = model('User');
  const role = options.role || 'member';
  const email = options.email || uniqueEmail(role);
  const password = options.password || DEFAULT_PASSWORD;
  const passwordHash = await bcrypt.hash(password, 12);

  const user = await User.create({
    email,
    passwordHash,
    role,
    displayName: options.displayName || `Test ${role}`,
    status: options.status || 'active',
  });

  return { user, email, password, role };
}

/**
 * Create a board row directly. Use the admin API instead when the test is about board
 * management itself.
 * @param {Partial<{slug:string,name:string,description:string,supportLevel:string,order:number,isActive:boolean}>} [overrides]
 * @returns {Promise<object>}
 */
async function createBoardRecord(overrides = {}) {
  const Board = model('Board');
  const suffix = crypto.randomBytes(3).toString('hex');
  return Board.create({
    slug: overrides.slug || `test-board-${suffix}`,
    name: overrides.name || `Test board ${suffix}`,
    description: overrides.description || 'A board created by the automated test suite.',
    icon: overrides.icon || '🕊️',
    supportLevel: overrides.supportLevel || 'peer',
    guidelines: overrides.guidelines || ['Be kind', 'No personal information'],
    tags: overrides.tags || ['support', 'anxiety'],
    order: overrides.order !== undefined ? overrides.order : 0,
    isActive: overrides.isActive !== undefined ? overrides.isActive : true,
    ...overrides,
  });
}

/**
 * Create a thread row directly (bypassing API rate limits) as an anonymous session.
 * @param {{sessionId:string, alias?:string, boardSlug:string, title?:string, body?:string, status?:string}} options
 * @returns {Promise<object>}
 */
async function createThreadRecord(options) {
  const Thread = model('Thread');
  const payload = threadPayload({
    boardSlug: options.boardSlug,
    title: options.title,
    body: options.body,
  });
  return Thread.create({
    boardSlug: payload.boardSlug,
    title: payload.title,
    body: payload.body,
    excerpt: payload.body.slice(0, 160),
    contentWarning: false,
    tags: payload.tags,
    authorType: options.authorType || 'anonymous',
    authorId: options.sessionId,
    authorModel: 'Session',
    authorAlias: options.alias || 'Anonymous',
    status: options.status || 'published',
  });
}

/**
 * Create a reply row directly.
 * @param {{threadId:string, sessionId:string, alias?:string, body?:string, status?:string}} options
 * @returns {Promise<object>}
 */
async function createReplyRecord(options) {
  const Reply = model('Reply');
  return Reply.create({
    thread: options.threadId,
    body: options.body || replyPayload().body,
    contentWarning: false,
    authorType: options.authorType || 'anonymous',
    authorId: options.sessionId,
    authorModel: 'Session',
    authorAlias: options.alias || 'Anonymous',
    status: options.status || 'published',
  });
}

/* -------------------------------------------------------------------------- */
/* Payload builders — must stay valid against the frozen API contract (§4.3).  */
/* -------------------------------------------------------------------------- */

/**
 * @param {Partial<{boardSlug:string,title:string,body:string,tags:string[],contentWarning:boolean}>} [overrides]
 * @returns {{boardSlug:string,title:string,body:string,tags:string[],contentWarning:boolean}}
 */
function threadPayload(overrides = {}) {
  return {
    boardSlug: 'general-support',
    title: 'Trying to find a steadier morning',
    body: 'I have been waking up anxious for a couple of weeks. Writing it down here helps a little.',
    tags: ['anxiety'],
    contentWarning: false,
    ...overrides,
  };
}

/**
 * @param {Partial<{body:string,contentWarning:boolean}>} [overrides]
 * @returns {{body:string,contentWarning:boolean}}
 */
function replyPayload(overrides = {}) {
  return {
    body: 'Thank you for sharing this. You are not alone in feeling that way.',
    contentWarning: false,
    ...overrides,
  };
}

/**
 * @param {Partial<{targetType:string,targetId:string,reason:string,details:string}>} [overrides]
 * @returns {{targetType:string,targetId:string,reason:string,details:string}}
 */
function reportPayload(overrides = {}) {
  return {
    targetType: 'reply',
    reason: 'harassment',
    details: 'This reply contains personal attacks.',
    ...overrides,
  };
}

/**
 * @param {Partial<{slug:string,name:string,description:string,supportLevel:string,order:number}>} [overrides]
 * @returns {object}
 */
function boardPayload(overrides = {}) {
  const suffix = crypto.randomBytes(3).toString('hex');
  return {
    slug: `created-board-${suffix}`,
    name: `Created board ${suffix}`,
    description: 'Board created through the admin API by the test suite.',
    icon: '🌿',
    supportLevel: 'general',
    guidelines: ['Be kind', 'Respect anonymity'],
    tags: ['support'],
    order: 10,
    ...overrides,
  };
}

/**
 * @param {Partial<{displayAlias:string,showCrisisBar:boolean,contentWarningDefault:boolean,reduceMotion:boolean}>} [overrides]
 * @returns {object}
 */
function preferencesPayload(overrides = {}) {
  return {
    displayAlias: 'Seeker Test',
    showCrisisBar: false,
    contentWarningDefault: true,
    reduceMotion: true,
    ...overrides,
  };
}

/**
 * @param {Partial<{title:string}>} [overrides]
 * @returns {{title:string}}
 */
function conversationPayload(overrides = {}) {
  return { title: 'Test conversation', ...overrides };
}

/**
 * @param {Partial<{content:string}>} [overrides]
 * @returns {{content:string}}
 */
function messagePayload(overrides = {}) {
  return { content: 'I am having a hard day and wanted to talk to someone.', ...overrides };
}

/**
 * Valid registration payload.
 * @param {Partial<{email:string,password:string,displayName:string}>} [overrides]
 * @returns {object}
 */
function registerPayload(overrides = {}) {
  return {
    email: uniqueEmail('register'),
    password: DEFAULT_PASSWORD,
    displayName: 'Test Member',
    ...overrides,
  };
}

module.exports = {
  DEFAULT_PASSWORD,
  uniqueEmail,
  model,
  createUserRecord,
  createBoardRecord,
  createThreadRecord,
  createReplyRecord,
  threadPayload,
  replyPayload,
  reportPayload,
  boardPayload,
  preferencesPayload,
  conversationPayload,
  messagePayload,
  registerPayload,
};
