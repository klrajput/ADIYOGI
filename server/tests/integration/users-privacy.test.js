'use strict';

/**
 * Users, preferences and privacy integration tests (docs/ARCHITECTURE.md §4.3, §6, §8).
 * Data deletion is a contractual privacy feature, so it is verified against the raw
 * MongoDB collections (not just API responses).
 */
const db = require('../helpers/db');
const app = require('../helpers/app');
const factories = require('../helpers/factories');
const { setProviderForTesting } = require('../../src/services/ai/provider');
const { expectSuccess, expectError } = require('../helpers/envelopes');

jest.setTimeout(60000);

beforeAll(async () => {
  await db.startDatabase();
});

afterEach(async () => {
  setProviderForTesting(null);
  await db.clearDatabase();
});

afterAll(async () => {
  await db.stopDatabase();
});

const STUB_TEXT = 'That sounds really heavy. Would it help to talk about what today was like?';

function installStubProvider() {
  setProviderForTesting({
    name: 'stub',
    model: 'stub-model',
    isConfigured: () => true,
    generate: async () => ({ text: STUB_TEXT }),
  });
}

describe('preferences', () => {
  it('returns the default preferences for a new session', async () => {
    const agent = await app.anonymousAgent();
    const res = await agent.get(app.apiPath('/users/me/preferences'));
    const { preferences } = expectSuccess(res);
    expect(preferences).toEqual(
      expect.objectContaining({
        displayAlias: expect.any(String),
        showCrisisBar: expect.any(Boolean),
        contentWarningDefault: expect.any(Boolean),
        reduceMotion: expect.any(Boolean),
      })
    );
    expect(preferences).not.toHaveProperty('ownerId');
  });

  it('PATCH persists preferences and they are returned on the next GET', async () => {
    const agent = await app.anonymousAgent();
    const patch = factories.preferencesPayload();

    const res = await agent.authPatch('/users/me/preferences', patch);
    const { preferences } = expectSuccess(res);
    expect(preferences).toEqual(expect.objectContaining(patch));

    const readBack = await agent.get(app.apiPath('/users/me/preferences'));
    expect(expectSuccess(readBack).preferences).toEqual(expect.objectContaining(patch));

    // Exactly one preference row per identity, updated in place.
    expect(await db.countDocuments('userpreferences')).toBe(1);
    const [stored] = await db.findRaw('userpreferences');
    expect(stored.showCrisisBar).toBe(false);
    expect(stored.contentWarningDefault).toBe(true);
    expect(stored.reduceMotion).toBe(true);
  });

  it('exposes the updated preferences through /auth/me', async () => {
    const agent = await app.anonymousAgent();
    await agent.authPatch('/users/me/preferences', { reduceMotion: true }).expect(200);
    const me = await agent.get(app.apiPath('/auth/me'));
    expect(expectSuccess(me).identity.preferences.reduceMotion).toBe(true);
  });

  it.each([
    ['empty body', {}],
    ['too-short alias', { displayAlias: 'ab' }],
    ['invalid alias characters', { displayAlias: 'bad@alias!' }],
    ['unknown field', { theme: 'dark' }],
    ['wrong type', { showCrisisBar: 'yes' }],
  ])('rejects invalid preference payload: %s', async (_label, payload) => {
    const agent = await app.anonymousAgent();
    const res = await agent.authPatch('/users/me/preferences', payload);
    expectError(res, 400, 'VALIDATION_ERROR');
  });
});

describe('GET /users/me/content', () => {
  it('lists the caller own threads and replies with pagination meta', async () => {
    const board = await factories.createBoardRecord({ slug: 'general-support' });
    const agent = await app.anonymousAgent();
    const threadRes = await agent.authPost('/threads', factories.threadPayload({ boardSlug: board.slug }));
    const thread = expectSuccess(threadRes).thread;

    // A reply by the caller on someone else's thread.
    const other = await app.anonymousAgent();
    const otherThreadRes = await other.authPost(
      '/threads',
      factories.threadPayload({ boardSlug: board.slug, title: 'Another person thread' })
    );
    const otherThread = expectSuccess(otherThreadRes).thread;
    await agent.authPost(`/threads/${otherThread.id}/replies`, factories.replyPayload());

    const threads = await agent.get(app.apiPath('/users/me/content?type=threads'));
    const threadData = expectSuccess(threads);
    expect(threadData.threads).toHaveLength(1);
    expect(threadData.threads[0].id).toBe(thread.id);
    expect(threads.body.meta.total).toBe(1);

    const replies = await agent.get(app.apiPath('/users/me/content?type=replies'));
    const replyData = expectSuccess(replies);
    expect(replyData.replies).toHaveLength(1);
    expect(replyData.replies[0].thread).toBe(otherThread.id);

    // Another session sees none of it.
    const stranger = await app.anonymousAgent();
    const strangerList = await stranger.get(app.apiPath('/users/me/content?type=threads'));
    expect(expectSuccess(strangerList).threads).toHaveLength(0);
  });

  it('validates the type query', async () => {
    const agent = await app.anonymousAgent();
    const res = await agent.get(app.apiPath('/users/me/content?type=everything'));
    expectError(res, 400, 'VALIDATION_ERROR');
  });
});

describe('DELETE /users/me — complete data deletion (§6, §8)', () => {
  it('hard-deletes anonymous content, conversations, messages, notifications and crisis metadata', async () => {
    installStubProvider();
    const board = await factories.createBoardRecord({ slug: 'general-support' });
    const { agent: userA, response: responseA } = await app.bootstrapAnonymous();
    const { agent: userB, response: responseB } = await app.bootstrapAnonymous();
    const sessionIdA = responseA.body.data.identity.id;
    const sessionIdB = responseB.body.data.identity.id;

    // A's thread + B's reply on it (creates a notification for A).
    const threadA = expectSuccess(
      await userA.authPost('/threads', factories.threadPayload({ boardSlug: board.slug }))
    ).thread;
    expectSuccess(await userB.authPost(`/threads/${threadA.id}/replies`, factories.replyPayload()));

    // B's thread + A's reply on it (leaves a notification for B).
    const threadB = expectSuccess(
      await userB.authPost(
        '/threads',
        factories.threadPayload({ boardSlug: board.slug, title: 'B thread about sleep' })
      )
    ).thread;
    expectSuccess(await userA.authPost(`/threads/${threadB.id}/replies`, factories.replyPayload()));

    // A's chat conversation with two persisted messages.
    const conversation = expectSuccess(
      await userA.authPost('/chat/conversations', factories.conversationPayload())
    ).conversation;
    expectSuccess(
      await userA.authPost(`/chat/conversations/${conversation.id}/messages`, factories.messagePayload())
    );

    // A's crisis metadata.
    expectSuccess(
      await userA.authPost('/crisis/events', { level: 'low', source: 'manual', country: 'IN' })
    );

    expect(await db.countDocuments('threads')).toBe(2);
    expect(await db.countDocuments('replies')).toBe(2);
    expect(await db.countDocuments('chatmessages')).toBe(2);
    expect(await db.countDocuments('notifications')).toBe(2);
    expect(await db.countDocuments('crisisevents')).toBe(1);

    const res = await userA.authDelete('/users/me', { deleteContent: true });
    expect(res.status).toBe(204);

    // A's thread is gone (B's thread remains) and A's reply is gone too.
    expect(await db.countDocuments('threads')).toBe(1);
    expect(await db.countDocuments('threads', { title: 'B thread about sleep' })).toBe(1);
    expect(await db.countDocuments('replies')).toBe(0);

    // Chat + crisis metadata purged hard.
    expect(await db.countDocuments('conversations')).toBe(0);
    expect(await db.countDocuments('chatmessages')).toBe(0);
    expect(await db.countDocuments('crisisevents')).toBe(0);

    // A's notification removed; B's notification (about A's reply) stays.
    expect(await db.countDocuments('notifications')).toBe(1);
    const [remainingNotification] = await db.findRaw('notifications');
    expect(String(remainingNotification.recipientId)).toBe(sessionIdB);

    // A's anonymous session is hard-deleted and no longer authenticates.
    const sessions = await db.findRaw('sessions');
    expect(sessions.some((session) => String(session._id) === sessionIdA)).toBe(false);
    expect(sessions.some((session) => String(session._id) === sessionIdB)).toBe(true);
    const me = await userA.get(app.apiPath('/auth/me'));
    expectError(me, 401, 'UNAUTHENTICATED');
  });

  it('revokes sessions and deletes the account row for a signed-in member', async () => {
    const payload = factories.registerPayload();
    const agent = await app.anonymousAgent();
    // Sessionless CSRF flow: bootstrap gave us a token, so register is CSRF-checked
    // (a session already exists on this agent).
    const registered = await agent.authPost('/auth/register', payload);
    const identity = expectSuccess(registered).identity;
    // Registration rotates the CSRF cookie: adopt the new token for later writes.
    agent.setCsrfToken(app.csrfFrom(registered) || app.cookiesFrom(registered).ay_csrf);
    expect(identity.kind).toBe('user');

    const board = await factories.createBoardRecord({ slug: 'general-support' });
    expectSuccess(await agent.authPost('/threads', factories.threadPayload({ boardSlug: board.slug })));

    const res = await agent.authDelete('/users/me');
    expect(res.status).toBe(204);

    expect(await db.countDocuments('users')).toBe(0);
    expect(await db.countDocuments('threads')).toBe(0);
    // All account-linked sessions are revoked; the throwaway anonymous session used to
    // bootstrap registration is a separate identity and is not account-linked.
    const sessions = await db.findRaw('sessions');
    const accountSessions = sessions.filter((session) => session.user);
    expect(accountSessions.length).toBeGreaterThan(0);
    expect(accountSessions.every((session) => session.revokedAt instanceof Date)).toBe(true);

    const me = await agent.get(app.apiPath('/auth/me'));
    expectError(me, 401, 'UNAUTHENTICATED');
  });
});

describe('crisis event privacy — metadata only, never text', () => {
  it('stores no message/content field on a crisis event', async () => {
    const agent = await app.anonymousAgent();
    const res = await agent.authPost('/crisis/events', {
      level: 'elevated',
      source: 'manual',
      country: 'US',
    });
    const data = expectSuccess(res);
    expect(data.acknowledged).toBe(true);
    expect(data.resources.primary.contact).toBeTruthy();

    expect(await db.countDocuments('crisisevents')).toBe(1);
    const [event] = await db.findRaw('crisisevents');
    const keys = Object.keys(event);
    ['text', 'message', 'content', 'body', 'transcript', 'userText'].forEach((forbidden) => {
      expect(keys).not.toContain(forbidden);
    });
    expect(event.level).toBe('elevated');
    expect(event.source).toBe('manual');
    expect(event.country).toBe('US');
    expect(Array.isArray(event.triggerCodes)).toBe(true);
    expect(event).not.toHaveProperty('ip');
    expect(event).not.toHaveProperty('userAgent');
  });
});
