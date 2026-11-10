#!/usr/bin/env node
/**
 * AdiYogi API end-to-end journey (docs/ARCHITECTURE.md §4–§8).
 *
 * Starts the real API on an ephemeral port against an in-memory MongoDB and drives a
 * complete user journey over real HTTP with a real cookie jar and CSRF double-submit:
 *
 *   anonymous session → browse boards → create thread → second anonymous user replies
 *   → notification for the author → report the reply → moderator login → queue
 *   → hide the reply → verify public visibility changed → crisis resources by region
 *   → crisis assess (high) → manual crisis event → delete own data → verify gone
 *
 * Run from the repository root:
 *   node e2e/journey.mjs
 *
 * No browser and no network access are required. Playwright browser E2E is intentionally
 * not part of this script (the sandbox cannot download Chromium reliably); see
 * docs/TESTING.md.
 */
import { createRequire } from 'module';
import path from 'path';
import os from 'os';
import fs from 'fs';

const require = createRequire(import.meta.url);
const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

// ---------------------------------------------------------------------------
// Environment must be configured before any server module is required.
// ---------------------------------------------------------------------------
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'e2e-jwt-secret-for-adiyogi-journey-0123456789';
process.env.SESSION_SECRET =
  process.env.SESSION_SECRET || 'e2e-session-secret-for-adiyogi-journey-0123456789';
process.env.AI_API_KEY = '';
process.env.AI_PROVIDER = 'gemini';
process.env.LOG_LEVEL = 'error';
process.env.SEED_ON_START = 'false';

const repoCacheDir = path.join(repoRoot, 'node_modules/.cache/mongodb-memory-server');
const tempCacheDir = path.join(os.tmpdir(), 'adiyogi-mongodb-binaries');
process.env.MONGOMS_DOWNLOAD_DIR =
  process.env.MONGOMS_DOWNLOAD_DIR || (fs.existsSync(repoCacheDir) ? repoCacheDir : tempCacheDir);
process.env.MONGOMS_DISABLE_POSTINSTALL = '1';

/* -------------------------------------------------------------------------- */
/* Tiny assertion + cookie-jar HTTP client (real HTTP, real cookies)          */
/* -------------------------------------------------------------------------- */

let checks = 0;
let failures = 0;

function assert(condition, message) {
  checks += 1;
  if (!condition) {
    failures += 1;
    throw new Error(`Assertion failed: ${message}`);
  }
}

function pass(label) {
  console.log(`  PASS  ${label}`);
}

class Browser {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
    this.cookies = new Map();
  }

  /** Store cookies from a response (honouring deletion via Max-Age=0). */
  storeCookies(response) {
    const raw = typeof response.headers.getSetCookie === 'function'
      ? response.headers.getSetCookie()
      : (response.headers.get('set-cookie') || '').split(/,(?=[^;]+=)/).filter(Boolean);

    raw.forEach((entry) => {
      const [pair, ...attributes] = entry.split(';').map((part) => part.trim());
      const separator = pair.indexOf('=');
      if (separator <= 0) return;
      const name = pair.slice(0, separator);
      const value = decodeURIComponent(pair.slice(separator + 1));
      const expired = attributes.some((attribute) => {
        const lower = attribute.toLowerCase();
        return lower === 'max-age=0' || /^expires=thu, 01 jan 1970/.test(lower);
      });
      if (expired || value === '') this.cookies.delete(name);
      else this.cookies.set(name, value);
    });
  }

  cookieHeader() {
    return Array.from(this.cookies.entries())
      .map(([name, value]) => `${name}=${encodeURIComponent(value)}`)
      .join('; ');
  }

  get(path) {
    return this.request('GET', path);
  }

  post(path, body) {
    return this.request('POST', path, body);
  }

  patch(path, body) {
    return this.request('PATCH', path, body);
  }

  delete(path, body) {
    return this.request('DELETE', path, body);
  }

  async request(method, path, body) {
    const url = `${this.baseUrl}/api/v1${path}`;
    const headers = { Accept: 'application/json' };
    const cookies = this.cookieHeader();
    if (cookies) headers.Cookie = cookies;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (method !== 'GET' && this.cookies.has('ay_csrf')) {
      headers['x-csrf-token'] = this.cookies.get('ay_csrf');
    }

    const response = await fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    this.storeCookies(response);

    const text = await response.text();
    let payload = null;
    if (text) {
      try {
        payload = JSON.parse(text);
      } catch {
        payload = null;
      }
    }
    return { status: response.status, body: payload, headers: response.headers };
  }

  async session() {
    const res = await this.post('/auth/session', {});
    assert(res.status === 200, `anonymous session bootstrap (got ${res.status})`);
    return res.body.data.identity;
  }

  async login(email, password) {
    const res = await this.post('/auth/login', { email, password });
    assert(res.status === 200, `login ${email} (got ${res.status}: ${JSON.stringify(res.body)})`);
    return res.body.data.identity;
  }
}

/* -------------------------------------------------------------------------- */
/* Main journey                                                               */
/* -------------------------------------------------------------------------- */

async function main() {
  const { MongoMemoryServer } = require('mongodb-memory-server');
  const bcrypt = require('bcryptjs');
  const createApp = require('../server/src/app');
  const database = require('../server/src/config/db');
  const models = require('../server/src/models');

  console.log('Starting in-memory MongoDB…');
  const mongo = await MongoMemoryServer.create({ instance: { dbName: 'adiyogi_e2e' } });
  const uri = mongo.getUri('adiyogi_e2e');
  await database.connectDatabase(uri);

  // Seed one board (the equivalent of the production board seeder).
  await models.Board.create({
    slug: 'general-support',
    name: 'General support',
    description: 'A gentle space for everyday mental-health struggles.',
    icon: '🌿',
    supportLevel: 'peer',
    guidelines: ['Be kind', 'Respect anonymity'],
    tags: ['support'],
    order: 1,
    isActive: true,
  });

  // A moderator account for the moderation leg of the journey.
  const moderatorEmail = 'moderator@example.test';
  const moderatorPassword = 'E2e-Moderator-Password!';
  await models.User.create({
    email: moderatorEmail,
    passwordHash: await bcrypt.hash(moderatorPassword, 12),
    role: 'moderator',
    displayName: 'E2E Moderator',
    status: 'active',
  });

  const app = createApp();
  const server = await new Promise((resolve, reject) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
    instance.once('error', reject);
  });
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;
  console.log(`API listening on ${baseUrl}\n`);

  try {
    /* 1. Anonymous session ------------------------------------------------- */
    const userA = new Browser(baseUrl);
    const identityA = await userA.session();
    assert(identityA.kind === 'anonymous', 'new session identity is anonymous');
    assert(identityA.isAnonymous === true, 'identity flags isAnonymous');
    assert(userA.cookies.has('ay_at') && userA.cookies.has('ay_rt') && userA.cookies.has('ay_csrf'), 'session sets ay_at/ay_rt/ay_csrf cookies');
    const me = await userA.get('/auth/me');
    assert(me.status === 200 && me.body.data.identity.id === identityA.id, '/auth/me returns the session identity');
    pass('anonymous session bootstrap + /auth/me');

    /* 2. Browse boards ------------------------------------------------------ */
    const boardList = await userA.get('/boards');
    assert(boardList.status === 200, 'GET /boards succeeds');
    const board = boardList.body.data.boards.find((entry) => entry.slug === 'general-support');
    assert(Boolean(board), 'seeded board appears in the public board list');
    assert(board.threadCount === 0, 'fresh board has threadCount 0');
    pass('browse boards');

    /* 3. Create a thread ---------------------------------------------------- */
    const threadRes = await userA.post('/threads', {
      boardSlug: 'general-support',
      title: 'A journalled morning anxiety check-in',
      body: 'I have been waking up anxious for two weeks and wanted to write it down somewhere safe.',
      tags: ['anxiety'],
    });
    assert(threadRes.status === 201, `thread created (got ${threadRes.status})`);
    const thread = threadRes.body.data.thread;
    assert(thread.author.type === 'anonymous', 'thread author type is anonymous');
    assert(thread.isOwner === true, 'author sees isOwner=true');
    assert(!('authorId' in thread), 'internal authorId is never serialized');
    pass('create thread');

    /* 4. Second anonymous user replies ------------------------------------- */
    const userB = new Browser(baseUrl);
    await userB.session();
    const replyRes = await userB.post(`/threads/${thread.id}/replies`, {
      body: 'Thank you for writing this down. You are not alone in that morning feeling.',
    });
    assert(replyRes.status === 201, `reply created (got ${replyRes.status})`);
    const reply = replyRes.body.data.reply;
    assert(reply.author.type === 'anonymous', 'reply author type is anonymous');
    pass('second anonymous user replies');

    /* 5. Notification for the thread author -------------------------------- */
    const notifications = await userA.get('/notifications');
    assert(notifications.status === 200, 'GET /notifications succeeds');
    assert(notifications.body.data.notifications.length === 1, 'thread author has one notification');
    const notification = notifications.body.data.notifications[0];
    assert(notification.type === 'thread_reply', 'notification type is thread_reply');
    assert(notification.read === false, 'notification is unread');
    const marked = await userA.patch(`/notifications/${notification.id}/read`, {});
    assert(marked.status === 200 && marked.body.data.notification.read === true, 'notification marked read');
    pass('notification created for author + marked read');

    /* 6. Report the reply (a third community member reports it) ------------- */
    const userC = new Browser(baseUrl);
    await userC.session();
    const reportRes = await userC.post('/reports', {
      targetType: 'reply',
      targetId: reply.id,
      reason: 'harassment',
      details: 'E2E journey: report filed by the second anonymous user.',
    });
    assert(reportRes.status === 201, `report created (got ${reportRes.status})`);
    const report = reportRes.body.data.report;
    assert(report.status === 'open', 'new report is open');
    const duplicate = await userC.post('/reports', { targetType: 'reply', targetId: reply.id, reason: 'spam' });
    assert(duplicate.status === 409, 'duplicate report is rejected with 409');
    pass('report the reply (+ duplicate rejected)');

    /* 7. Moderator login ---------------------------------------------------- */
    const moderator = new Browser(baseUrl);
    const moderatorIdentity = await moderator.login(moderatorEmail, moderatorPassword);
    assert(moderatorIdentity.role === 'moderator', 'moderator login returns moderator role');
    pass('moderator login');

    /* 8. Queue + hide the reply --------------------------------------------- */
    const queue = await moderator.get('/moderation/queue');
    assert(queue.status === 200, 'moderator can read the queue');
    assert(
      queue.body.data.reports.some((entry) => entry.id === report.id),
      'the open report appears in the moderation queue'
    );

    const hideRes = await moderator.post('/moderation/actions', {
      action: 'hide',
      targetType: 'reply',
      targetId: reply.id,
      reportId: report.id,
      reason: 'E2E journey: hiding this reply for review.',
    });
    assert(hideRes.status === 201, `hide action applied (got ${hideRes.status})`);
    assert(hideRes.body.data.moderationAction.action === 'hide', 'audit entry records the hide action');
    const resolvedReport = await moderator.get(`/reports?status=resolved`);
    assert(
      resolvedReport.body.data.reports.some((entry) => entry.id === report.id),
      'report was resolved by the moderation action'
    );
    const audit = await moderator.get('/moderation/actions');
    assert(audit.body.data.actions.some((entry) => entry.action === 'hide'), 'audit log lists the hide action');
    pass('moderation queue → hide reply → audit log');

    /* 9. Public visibility changed ------------------------------------------ */
    const publicReplies = await userA.get(`/threads/${thread.id}/replies`);
    assert(publicReplies.status === 200, 'public reply list still readable');
    assert(
      !publicReplies.body.data.replies.some((entry) => entry.id === reply.id),
      'hidden reply no longer appears in the public reply list'
    );
    pass('public visibility changed after moderation');

    /* 10. Crisis resources by region ---------------------------------------- */
    for (const country of ['US', 'IN', 'GB']) {
      // eslint-disable-next-line no-await-in-loop
      const resources = await userA.get(`/crisis/resources?country=${country}`);
      assert(resources.status === 200, `crisis resources for ${country} succeed`);
      const payload = resources.body.data.resources;
      assert(payload.region === country, `crisis resources region is ${country}`);
      assert(Boolean(payload.primary.contact), `crisis resources for ${country} include a primary contact`);
      assert(payload.international.url.includes('findahelpline.com'), `${country} resources include the INTL fallback`);
    }
    pass('crisis resources by region');

    /* 11. Crisis assess (high) ---------------------------------------------- */
    const assess = await userA.post('/crisis/assess', { text: 'I want to kill myself tonight', source: 'assessment' });
    assert(assess.status === 200, 'crisis assess succeeds');
    assert(assess.body.data.assessment.level === 'high', 'explicit intent is assessed as high');
    assert(assess.body.data.assessment.showResources === true, 'high assessment surfaces resources');
    const eventsAfterAssess = await models.CrisisEvent.countDocuments({});
    assert(eventsAfterAssess === 0, 'crisis assess stores nothing in the database');
    pass('crisis assess (high) stores no text');

    /* 12. Manual crisis event ----------------------------------------------- */
    const eventRes = await userA.post('/crisis/events', { level: 'high', source: 'manual', country: 'IN' });
    assert(eventRes.status === 200, 'manual crisis event acknowledged');
    assert(eventRes.body.data.acknowledged === true, 'manual crisis event returns acknowledged:true');
    assert(eventRes.body.data.resources.region === 'IN', 'manual crisis event returns regional resources');
    const storedEvent = await models.CrisisEvent.findOne({}).lean();
    assert(Boolean(storedEvent), 'manual crisis event is persisted as metadata');
    assert(!('text' in storedEvent) && !('content' in storedEvent), 'crisis event stores metadata only (no text field)');
    pass('manual crisis event (metadata only)');

    /* 13. Delete own data --------------------------------------------------- */
    const deleteRes = await userA.delete('/users/me', { deleteContent: true });
    assert(deleteRes.status === 204, `DELETE /users/me returns 204 (got ${deleteRes.status})`);
    const afterDelete = await userA.get('/auth/me');
    assert(afterDelete.status === 401, 'deleted session no longer authenticates');
    const threadAfter = await models.Thread.findById(thread.id).lean();
    assert(threadAfter === null, 'the user thread was hard-deleted');
    assert((await models.CrisisEvent.countDocuments({})) === 0, 'user crisis metadata was deleted');
    pass('delete own data → session revoked, content gone');

    /* 14. Verify gone from the public surface ------------------------------- */
    const finalList = await new Browser(baseUrl).get('/threads');
    assert(finalList.status === 200, 'public thread list still readable');
    assert(
      !finalList.body.data.threads.some((entry) => entry.id === thread.id),
      'deleted thread is gone from the public list'
    );
    pass('verify deleted content gone from public surface');

    console.log(`\nE2E journey complete: ${checks} assertions passed, ${failures} failed.`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await database.disconnectDatabase();
    await mongo.stop();
  }
}

main().catch((error) => {
  console.error(`\nE2E journey FAILED after ${checks} checks:`);
  console.error(error && error.stack ? error.stack : error);
  process.exitCode = 1;
});
