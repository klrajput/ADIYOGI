'use strict';

/* Orchestrator integration check: boots the REAL app against an in-memory MongoDB and
 * exercises the complete user journey over real HTTP (cookies + CSRF included).
 * Lives in .tmp/ (gitignored) — not part of the shipped test suite. */

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'integration-check-jwt-secret-0123456789';
process.env.SESSION_SECRET = 'integration-check-session-secret-0123456789';
process.env.AI_API_KEY = '';
process.env.AI_PROVIDER = 'gemini';
process.env.LOG_LEVEL = 'error';
process.env.SEED_ON_START = 'false';

const http = require('http');
const { MongoMemoryServer } = require('mongodb-memory-server');
const bcrypt = require('bcryptjs');

const results = [];
function check(name, condition, detail) {
  results.push({ name, ok: Boolean(condition), detail });
  if (!condition) console.error(`FAIL  ${name}${detail ? ` :: ${detail}` : ''}`);
}

function makeJar() {
  const jar = new Map();
  return {
    header() {
      return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
    },
    absorb(response) {
      const raw = response.headers.getSetCookie ? response.headers.getSetCookie() : [];
      raw.forEach((cookie) => {
        const [pair] = cookie.split(';');
        const index = pair.indexOf('=');
        const name = pair.slice(0, index).trim();
        const value = pair.slice(index + 1).trim();
        if (value === '' ) jar.delete(name);
        else jar.set(name, value);
      });
      return raw;
    },
    get(name) {
      return jar.get(name);
    },
  };
}

async function main() {
  const mongod = await MongoMemoryServer.create();
  const { connectDatabase, disconnectDatabase } = require('../../server/src/config/db');
  await connectDatabase(mongod.getUri());

  const { seedBoards } = require('../../server/src/services/seedService');
  await seedBoards();

  const createApp = require('../../server/src/app');
  const server = http.createServer(createApp());
  await new Promise((resolve) => server.listen(0, resolve));
  const base = `http://127.0.0.1:${server.address().port}`;

  async function call(jar, method, path, body, extraHeaders = {}, options = {}) {
    const headers = { Accept: 'application/json', ...extraHeaders };
    if (jar.header()) headers.Cookie = jar.header();
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (jar.get('ay_csrf') && !['GET', 'HEAD'].includes(method) && !options.omitCsrf) {
      headers['x-csrf-token'] = jar.get('ay_csrf');
    }
    const response = await fetch(`${base}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const setCookies = jar.absorb(response);
    const text = await response.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
    return { status: response.status, json, text, headers: response.headers, setCookies };
  }

  try {
    // ---------- health ----------
    let res = await call(makeJar(), 'GET', '/health');
    check('GET /health 200', res.status === 200 && res.json?.data?.status === 'ok', res.text.slice(0, 120));
    res = await call(makeJar(), 'GET', '/health/ready');
    check('GET /health/ready 200 with db connected', res.status === 200, res.text.slice(0, 120));
    res = await call(makeJar(), 'GET', '/api/v1/health');
    check('GET /api/v1/health 200', res.status === 200, String(res.status));

    // ---------- anonymous session / CSRF ----------
    const anon1 = makeJar();
    res = await call(anon1, 'POST', '/api/v1/auth/session', {});
    check('POST /auth/session 200', res.status === 200, res.text.slice(0, 200));
    check('anonymous identity shape', res.json?.data?.identity?.kind === 'anonymous' && Boolean(res.json?.data?.identity?.alias), JSON.stringify(res.json?.data?.identity));
    check('csrf token available (cookie)', Boolean(anon1.get('ay_csrf')));
    const rawSetCookies = res.setCookies.join('|');
    check('access cookie httpOnly', /ay_at=[^;]+;.*HttpOnly/i.test(rawSetCookies), rawSetCookies.slice(0, 200));
    check('refresh cookie httpOnly', /ay_rt=[^;]+;.*HttpOnly/i.test(rawSetCookies), rawSetCookies.slice(0, 200));

    res = await call(anon1, 'GET', '/api/v1/auth/me');
    check('GET /auth/me 200', res.status === 200 && res.json?.data?.identity?.kind === 'anonymous', res.text.slice(0, 160));

    // ---------- boards ----------
    res = await call(anon1, 'GET', '/api/v1/boards');
    const boards = res.json?.data?.boards || [];
    check('GET /boards returns 9 seeded boards', res.status === 200 && boards.length === 9, `count=${boards.length}`);
    const anxiety = boards.find((b) => b.slug === 'anxiety');
    check('board has supportLevel + guidelines', Boolean(anxiety?.supportLevel && Array.isArray(anxiety?.guidelines)));
    check('board threadCount starts at 0 (no fabricated stats)', anxiety?.threadCount === 0, String(anxiety?.threadCount));

    // ---------- CSRF enforcement ----------
    res = await call(anon1, 'POST', '/api/v1/threads', { boardSlug: 'anxiety', title: 'No csrf', body: 'x'.repeat(40) }, {}, { omitCsrf: true });
    check('POST /threads without CSRF → 403 CSRF_INVALID', res.status === 403 && res.json?.error?.code === 'CSRF_INVALID', res.text.slice(0, 160));

    // ---------- thread create / read ----------
    res = await call(anon1, 'POST', '/api/v1/threads', {
      boardSlug: 'anxiety',
      title: 'Panic attacks before meetings',
      body: 'I have been having panic attacks before every stand-up meeting. Breathing helps a little. Has anyone found something that works?',
      tags: ['panic', 'work'],
      contentWarning: false,
    });
    const thread = res.json?.data?.thread;
    check('POST /threads 201 + thread', res.status === 201 && Boolean(thread?.id), res.text.slice(0, 200));
    check('thread owner flags', thread?.isOwner === true && thread?.canEdit === true);
    check('thread author alias present, no authorId leak', Boolean(thread?.author?.alias) && !('authorId' in (thread || {})), JSON.stringify(thread?.author));
    const threadId = thread?.id;

    res = await call(anon1, 'GET', `/api/v1/threads/${threadId}`);
    check('GET /threads/:id 200', res.status === 200 && res.json?.data?.thread?.id === threadId, String(res.status));
    res = await call(anon1, 'GET', '/api/v1/threads?board=anxiety&limit=5');
    check('GET /threads filtered + meta', res.status === 200 && res.json?.data?.threads?.length === 1 && res.json?.meta?.total === 1, JSON.stringify(res.json?.meta));
    res = await call(anon1, 'GET', '/api/v1/threads?q=panic');
    check('GET /threads full-text search', res.status === 200 && (res.json?.data?.threads || []).length >= 1, res.text.slice(0, 200));
    res = await call(anon1, 'GET', '/api/v1/threads/not-a-valid-id');
    check('invalid thread id → 400/404 envelope', [400, 404].includes(res.status) && res.json?.success === false, String(res.status));

    // ---------- second anonymous user sees the same data (real persistence) ----------
    const anon2 = makeJar();
    await call(anon2, 'POST', '/api/v1/auth/session', {});
    res = await call(anon2, 'GET', `/api/v1/threads/${threadId}`);
    check('second session sees the first session thread (MongoDB, not localStorage)', res.status === 200, String(res.status));
    check('second session is not the owner', res.json?.data?.thread?.isOwner === false);

    res = await call(anon2, 'POST', `/api/v1/threads/${threadId}/replies`, {
      body: 'Grounding before the meeting helped me — 5 things I can see, then slow breathing. You are not alone.',
    });
    check('POST reply 201', res.status === 201 && Boolean(res.json?.data?.reply?.id), res.text.slice(0, 200));

    res = await call(anon1, 'GET', '/api/v1/notifications?unreadOnly=true');
    const notifications = res.json?.data?.notifications || [];
    check('thread author notified of reply', res.status === 200 && notifications.length === 1 && notifications[0].type === 'thread_reply', JSON.stringify(notifications).slice(0, 200));
    check('notification does not leak reply body', !JSON.stringify(notifications).includes('Grounding before'));

    // ---------- reports + moderation ----------
    res = await call(anon2, 'POST', '/api/v1/reports', { targetType: 'thread', targetId: threadId, reason: 'other', details: 'Integration check report' });
    check('POST /reports 201', res.status === 201, res.text.slice(0, 200));
    res = await call(anon2, 'POST', '/api/v1/reports', { targetType: 'thread', targetId: threadId, reason: 'other' });
    check('duplicate report → 409', res.status === 409, `${res.status} ${res.text.slice(0, 120)}`);

    const User = require('../../server/src/models/User');
    await User.create({ email: 'mod@adiyogi.test', passwordHash: await bcrypt.hash('ModeratorPass123!', 12), role: 'moderator', displayName: 'Mod' });
    const mod = makeJar();
    await call(mod, 'POST', '/api/v1/auth/session', {});
    res = await call(mod, 'POST', '/api/v1/auth/login', { email: 'mod@adiyogi.test', password: 'ModeratorPass123!' });
    check('POST /auth/login 200 (moderator)', res.status === 200 && res.json?.data?.identity?.role === 'moderator', res.text.slice(0, 200));

    res = await call(mod, 'GET', '/api/v1/reports');
    check('moderator GET /reports', res.status === 200 && (res.json?.data?.reports || []).length >= 1, res.text.slice(0, 200));
    res = await call(anon1, 'GET', '/api/v1/reports');
    check('member cannot read reports (403/401)', [401, 403].includes(res.status), String(res.status));

    res = await call(mod, 'POST', '/api/v1/moderation/actions', { action: 'hide', targetType: 'thread', targetId: threadId, reason: 'Integration check hide' });
    check('moderator hide thread', res.status === 200 || res.status === 201, `${res.status} ${res.text.slice(0, 160)}`);
    res = await call(anon2, 'GET', `/api/v1/threads/${threadId}`);
    check('hidden thread not visible to members', res.status === 404, String(res.status));
    res = await call(mod, 'POST', '/api/v1/moderation/actions', { action: 'unhide', targetType: 'thread', targetId: threadId, reason: 'Integration check unhide' });
    check('moderator unhide thread', res.status === 200 || res.status === 201, String(res.status));
    res = await call(mod, 'GET', '/api/v1/moderation/actions');
    check('moderation audit log has entries', res.status === 200 && (res.json?.data?.actions || []).length >= 2, res.text.slice(0, 160));
    res = await call(mod, 'GET', '/api/v1/moderation/stats');
    check('moderation stats', res.status === 200 && Boolean(res.json?.data?.stats), res.text.slice(0, 200));

    // ---------- crisis ----------
    res = await call(anon1, 'GET', '/api/v1/crisis/resources?country=IN');
    const inResources = res.json?.data?.resources;
    check('crisis resources IN', res.status === 200 && JSON.stringify(inResources).includes('1800-599-0019') || JSON.stringify(inResources).includes('14416'), res.text.slice(0, 220));
    res = await call(anon1, 'GET', '/api/v1/crisis/resources?country=ZZ');
    check('crisis resources unknown country → international fallback', res.status === 200 && JSON.stringify(res.json?.data?.resources).toLowerCase().includes('findahelpline'), res.text.slice(0, 200));
    res = await call(anon1, 'POST', '/api/v1/crisis/assess', { text: 'I have a plan to kill myself tonight and I have written a goodbye note.' });
    const assessment = res.json?.data?.assessment;
    check('crisis assess high risk', res.status === 200 && assessment?.level === 'high' && assessment?.showResources === true, JSON.stringify(assessment));
    check('crisis assess does not echo the text', !res.text.includes('goodbye note'));
    res = await call(anon1, 'POST', '/api/v1/crisis/events', { level: 'high', source: 'manual', country: 'IN' });
    check('POST /crisis/events acknowledged', res.status === 200 || res.status === 201, `${res.status} ${res.text.slice(0, 160)}`);
    const CrisisEvent = require('../../server/src/models/CrisisEvent');
    const events = await CrisisEvent.find({}).lean();
    check('crisis event stored metadata only', events.length === 1 && !JSON.stringify(events[0]).includes('goodbye') && Boolean(events[0].level), JSON.stringify(events[0]).slice(0, 200));

    // ---------- with a stubbed AI provider ----------
    const provider = require('../../server/src/services/ai/provider');
    provider.setProviderForTesting({
      name: 'stub',
      model: 'stub-1',
      isConfigured: () => true,
      generate: async () => ({ text: 'I hear how heavy this feels. Would it help to try one slow breath together?', usage: { totalTokens: 10 } }),
    });
    res = await call(anon1, 'POST', '/api/v1/chat/conversations', {});
    const conversation = res.json?.data?.conversation;
    check('POST /chat/conversations 201', res.status === 201 && Boolean(conversation?.id), res.text.slice(0, 200));
    res = await call(anon1, 'POST', `/api/v1/chat/conversations/${conversation.id}/messages`, { content: 'I feel anxious all the time and cannot sleep.' });
    check('POST chat message 200 with AI reply', res.status === 200 && Boolean(res.json?.data?.assistantMessage?.content), `${res.status} ${res.text.slice(0, 220)}`);
    check('chat response discloses provider + degraded flag', res.json?.data?.ai?.degraded === false, JSON.stringify(res.json?.data?.ai));
    res = await call(anon1, 'GET', `/api/v1/chat/conversations/${conversation.id}`);
    check('chat history persisted', res.status === 200 && (res.json?.data?.messages || []).length === 2, res.text.slice(0, 200));
    const ChatMessage = require('../../server/src/models/ChatMessage');
    const storedMessages = await ChatMessage.find({}).lean();
    check('AI provider key never exposed to client', !JSON.stringify(res.json).includes('apiKey'));
    check('chat messages persisted in MongoDB', storedMessages.length === 2, String(storedMessages.length));

    // provider failure → honest 503, nothing persisted
    provider.setProviderForTesting({
      name: 'stub',
      model: 'stub-1',
      isConfigured: () => true,
      generate: async () => {
        throw Object.assign(new Error('provider down'), { code: 'AI_PROVIDER_ERROR' });
      },
    });
    res = await call(anon1, 'POST', `/api/v1/chat/conversations/${conversation.id}/messages`, { content: 'Are you there?' });
    check('AI failure → 503 AI_UNAVAILABLE (no fabricated reply)', res.status === 503 && res.json?.error?.code === 'AI_UNAVAILABLE', `${res.status} ${res.text.slice(0, 200)}`);
    const afterFailure = await ChatMessage.find({}).lean();
    check('AI failure persists no partial messages', afterFailure.length === storedMessages.length, `${afterFailure.length} vs ${storedMessages.length}`);
    provider.setProviderForTesting(null);

    // unconfigured provider path
    provider.setProviderForTesting(null);
    const unconfigured = require('../../server/src/config/env').ai.isConfigured;
    if (!unconfigured) {
      res = await call(anon1, 'POST', `/api/v1/chat/conversations/${conversation.id}/messages`, { content: 'hello again' });
      check('AI not configured → 503 AI_UNAVAILABLE', res.status === 503 && res.json?.error?.code === 'AI_UNAVAILABLE', `${res.status} ${res.text.slice(0, 200)}`);
    }

    // ---------- preferences + own content + deletion ----------
    res = await call(anon1, 'PATCH', '/api/v1/users/me/preferences', { displayAlias: 'Quiet River' });
    check('PATCH preferences persists', res.status === 200 && res.json?.data?.preferences?.displayAlias === 'Quiet River', res.text.slice(0, 200));
    res = await call(anon1, 'GET', '/api/v1/users/me/content?type=threads');
    const ownThreads = res.json?.data?.threads || res.json?.data?.items || [];
    check('GET own content', res.status === 200 && ownThreads.length === 1, res.text.slice(0, 200));
    res = await call(anon1, 'DELETE', '/api/v1/users/me', { deleteContent: true });
    check('DELETE /users/me 204', res.status === 204, `${res.status} ${res.text.slice(0, 160)}`);
    const Thread = require('../../server/src/models/Thread');
    const remaining = await Thread.countDocuments({});
    check('deleted user content removed from DB', remaining === 0, String(remaining));

    // ---------- docs ----------
    res = await call(makeJar(), 'GET', '/api/docs/openapi.json');
    const spec = res.json;
    check('openapi.json valid', res.status === 200 && spec?.openapi?.startsWith('3.') && Boolean(spec?.paths?.['/api/v1/threads']), String(res.status));

    // ---------- misc envelope checks ----------
    res = await call(makeJar(), 'GET', '/api/v1/does-not-exist');
    check('unknown route → 404 envelope', res.status === 404 && res.json?.error?.code === 'NOT_FOUND', res.text.slice(0, 160));
    check('request id echoed', Boolean(res.json?.requestId || res.headers.get('x-request-id')));

    // ---------- board counters ----------
    res = await call(makeJar(), 'GET', '/api/v1/boards');
    const after = (res.json?.data?.boards || []).find((b) => b.slug === 'anxiety');
    check('board counters updated after create+delete', after && after.threadCount === 0, JSON.stringify(after?.threadCount));
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await disconnectDatabase();
    await mongod.stop();
  }

  const passed = results.filter((r) => r.ok).length;
  console.log(`\n=== INTEGRATION CHECK: ${passed}/${results.length} passed ===`);
  results.filter((r) => !r.ok).forEach((r) => console.log(`  FAILED: ${r.name} :: ${r.detail || ''}`));
  if (passed !== results.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error('INTEGRATION CHECK CRASHED:', error);
  process.exit(1);
});
