'use strict';

/**
 * Boards + threads integration tests (docs/ARCHITECTURE.md §4.3, §5, §12.7).
 * Real HTTP, real auth/CSRF, real MongoDB.
 */
const db = require('../helpers/db');
const app = require('../helpers/app');
const factories = require('../helpers/factories');
const { expectSuccess, expectError, expectPaginationMeta } = require('../helpers/envelopes');

jest.setTimeout(60000);

beforeAll(async () => {
  await db.startDatabase();
});

afterEach(async () => {
  await db.clearDatabase();
});

afterAll(async () => {
  await db.stopDatabase();
});

/** @returns {Promise<{agent: object, board: object}>} */
async function agentWithBoard() {
  const board = await factories.createBoardRecord({ slug: 'general-support', name: 'General support' });
  const agent = await app.anonymousAgent();
  return { agent, board };
}

async function createThread(agent, boardSlug, overrides = {}) {
  const res = await agent.authPost('/threads', factories.threadPayload({ boardSlug, ...overrides }));
  return { res, thread: expectSuccess(res).thread };
}

describe('GET /boards', () => {
  it('lists active boards with live counters and pagination meta', async () => {
    const board = await factories.createBoardRecord({ slug: 'anxiety', name: 'Anxiety' });
    await factories.createBoardRecord({ slug: 'inactive-board', isActive: false });
    const { agent } = await agentWithBoard();
    await createThread(agent, board.slug);

    const res = await app.client().get(app.apiPath('/boards'));
    const data = expectSuccess(res);
    expect(Array.isArray(data.boards)).toBe(true);
    expectPaginationMeta(res.body.meta);

    const slugs = data.boards.map((entry) => entry.slug);
    expect(slugs).toContain('anxiety');
    expect(slugs).not.toContain('inactive-board');

    const listed = data.boards.find((entry) => entry.slug === 'anxiety');
    expect(listed.threadCount).toBe(1);
    expect(listed).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        slug: 'anxiety',
        name: 'Anxiety',
        supportLevel: expect.any(String),
        guidelines: expect.any(Array),
        tags: expect.any(Array),
        replyCount: expect.any(Number),
      })
    );
    // Board public JSON must not leak internal Mongo fields.
    expect(listed).not.toHaveProperty('_id');
    expect(listed).not.toHaveProperty('__v');
  });

  it('returns a single board and 404 for an unknown slug', async () => {
    await factories.createBoardRecord({ slug: 'known-board', name: 'Known' });
    const found = await app.client().get(app.apiPath('/boards/known-board'));
    expect(expectSuccess(found).board.slug).toBe('known-board');

    const missing = await app.client().get(app.apiPath('/boards/does-not-exist'));
    expectError(missing, 404, 'NOT_FOUND');
  });

  it('requires admin role to manage boards (authorization matrix §6.4)', async () => {
    const anonymous = await app.anonymousAgent();
    const member = await app.memberAgent();
    const moderator = await app.moderatorAgent();
    const admin = await app.adminAgent();
    const payload = factories.boardPayload();

    for (const agent of [anonymous, member, moderator]) {
      // eslint-disable-next-line no-await-in-loop
      const res = await agent.authPost('/boards', payload);
      expect([401, 403]).toContain(res.status);
    }

    const created = await admin.authPost('/boards', payload);
    expect(created.status).toBe(201);
    expect(expectSuccess(created).board.slug).toBe(payload.slug);

    const patched = await admin.authPatch(`/boards/${payload.slug}`, { name: 'Renamed board' });
    expect(expectSuccess(patched).board.name).toBe('Renamed board');

    const removed = await admin.authDelete(`/boards/${payload.slug}`);
    expect(removed.status).toBe(204);

    // Deactivated boards disappear from the public list.
    const list = await app.client().get(app.apiPath('/boards'));
    expect(expectSuccess(list).boards.map((entry) => entry.slug)).not.toContain(payload.slug);
  });
});

describe('POST /threads — validation', () => {
  it.each([
    ['too-short title', { title: 'hi' }],
    ['too-short body', { body: 'too short' }],
    ['too many tags', { tags: ['a1', 'b2', 'c3', 'd4', 'e5', 'f6', 'g7'] }],
    ['invalid tag characters', { tags: ['Not A Tag!'] }],
    ['unknown board', { boardSlug: 'no-such-board' }],
  ])('rejects %s', async (_label, overrides) => {
    const { agent } = await agentWithBoard();
    const payload = factories.threadPayload(overrides);
    if (overrides.boardSlug) payload.boardSlug = overrides.boardSlug;
    const res = await agent.authPost('/threads', payload);

    if (overrides.boardSlug) {
      expectError(res, 404, 'NOT_FOUND');
      return;
    }
    const error = expectError(res, 400, 'VALIDATION_ERROR');
    expect(Array.isArray(error.details)).toBe(true);
    expect(error.details.length).toBeGreaterThan(0);
    expect(error.details.every((detail) => typeof detail.path === 'string')).toBe(true);
  });

  it('requires a session to create a thread', async () => {
    const board = await factories.createBoardRecord({ slug: 'general-support' });
    const res = await app.client().post(app.apiPath('/threads')).send(factories.threadPayload({ boardSlug: board.slug }));
    // No session: CSRF is checked first, and both outcomes are refusals.
    expect([401, 403]).toContain(res.status);
    expect(['UNAUTHENTICATED', 'CSRF_INVALID']).toContain(res.body.error.code);
  });

  it('rejects a body over the 5000-character limit', async () => {
    const { agent } = await agentWithBoard();
    const res = await agent.authPost(
      '/threads',
      factories.threadPayload({ boardSlug: 'general-support', body: 'x'.repeat(5001) })
    );
    expectError(res, 400, 'VALIDATION_ERROR');
  });
});

describe('thread lifecycle', () => {
  it('creates a thread and returns the frozen public shape + owner flags', async () => {
    const { agent, board } = await agentWithBoard();
    const res = await agent.authPost('/threads', factories.threadPayload({ boardSlug: board.slug }));

    expect(res.status).toBe(201);
    const { thread } = expectSuccess(res);
    expect(thread).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        boardSlug: 'general-support',
        title: expect.any(String),
        body: expect.any(String),
        excerpt: expect.any(String),
        tags: ['anxiety'],
        contentWarning: false,
        status: 'published',
        isPinned: false,
        isLocked: false,
        replyCount: 0,
        viewCount: 0,
        isOwner: true,
        canEdit: true,
        canDelete: true,
      })
    );
    expect(thread.author).toEqual({ alias: expect.any(String), type: 'anonymous' });
    // Forbidden internal identity fields (§12.7).
    ['authorId', 'authorModel', 'moderatedBy', '_id', '__v'].forEach((key) => {
      expect(thread).not.toHaveProperty(key);
    });

    const boardAfter = await app.client().get(app.apiPath(`/boards/${board.slug}`));
    expect(expectSuccess(boardAfter).board.threadCount).toBe(1);
  });

  it('lists threads with pagination meta, board filter and sort options', async () => {
    const { agent, board } = await agentWithBoard();
    for (const title of ['First thread about anxiety', 'Second thread about sleep', 'Third thread about work']) {
      // eslint-disable-next-line no-await-in-loop
      await createThread(agent, board.slug, { title });
    }

    const page1 = await app.client().get(app.apiPath('/threads?page=1&limit=2'));
    const data = expectSuccess(page1);
    expect(data.threads).toHaveLength(2);
    expectPaginationMeta(page1.body.meta, { page: 1, limit: 2, total: 3 });
    expect(page1.body.meta.hasNext).toBe(true);
    expect(page1.body.meta.hasPrev).toBe(false);

    const page2 = await app.client().get(app.apiPath('/threads?page=2&limit=2'));
    expectPaginationMeta(page2.body.meta, { page: 2, limit: 2, total: 3 });
    expect(page2.body.meta.hasNext).toBe(false);
    expect(page2.body.meta.hasPrev).toBe(true);

    const filtered = await app.client().get(app.apiPath('/threads?board=general-support'));
    expect(expectSuccess(filtered).threads.every((thread) => thread.boardSlug === 'general-support')).toBe(true);

    const otherBoard = await factories.createBoardRecord({ slug: 'other-board' });
    await createThread(agent, otherBoard.slug, { title: 'A thread on another board' });
    const justOther = await app.client().get(app.apiPath('/threads?board=other-board'));
    expect(expectSuccess(justOther).threads).toHaveLength(1);

    // Sort orders are accepted and return the documented sort key shape.
    for (const sort of ['recent', 'new', 'replies']) {
      // eslint-disable-next-line no-await-in-loop
      const res = await app.client().get(app.apiPath(`/threads?sort=${sort}`));
      expect(res.status).toBe(200);
      expect(Array.isArray(expectSuccess(res).threads)).toBe(true);
    }
  });

  it('searches title and body with q', async () => {
    const { agent, board } = await agentWithBoard();
    await createThread(agent, board.slug, { title: 'A thread about medication', body: 'I started a new prescription and wanted to compare notes with people.' });
    await createThread(agent, board.slug, { title: 'Completely different topic', body: 'Talking about sleep schedules and morning routines.' });

    const res = await app.client().get(app.apiPath('/threads?q=medication'));
    const threads = expectSuccess(res).threads;
    expect(threads).toHaveLength(1);
    expect(threads[0].title).toContain('medication');

    const empty = await app.client().get(app.apiPath('/threads?q=zzzznotfound'));
    expect(expectSuccess(empty).threads).toHaveLength(0);
    expect(empty.body.meta.total).toBe(0);
  });

  it('increments viewCount (throttled per viewer) and exposes isOwner for the author', async () => {
    const { agent, board } = await agentWithBoard();
    const { thread } = await createThread(agent, board.slug);

    const first = await agent.get(app.apiPath(`/threads/${thread.id}`));
    expect(expectSuccess(first).thread.isOwner).toBe(true);

    await new Promise((resolve) => setTimeout(resolve, 100));
    const second = await agent.get(app.apiPath(`/threads/${thread.id}`));
    expect(expectSuccess(second).thread.viewCount).toBe(1);

    // Same viewer within the throttle window: no further increment.
    const third = await agent.get(app.apiPath(`/threads/${thread.id}`));
    expect(expectSuccess(third).thread.viewCount).toBe(1);

    // A different viewer sees isOwner=false.
    const other = await app.anonymousAgent();
    const otherView = await other.get(app.apiPath(`/threads/${thread.id}`));
    expect(expectSuccess(otherView).thread.isOwner).toBe(false);
  });

  it('allows the author to update within 15 minutes', async () => {
    const { agent, board } = await agentWithBoard();
    const { thread } = await createThread(agent, board.slug);

    const res = await agent.authPatch(`/threads/${thread.id}`, {
      title: 'An updated thread title',
      body: 'An updated body that is comfortably longer than twenty characters.',
    });
    const updated = expectSuccess(res).thread;
    expect(updated.title).toBe('An updated thread title');
    expect(updated.editedAt).toBeTruthy();
  });

  it('refuses updates from another session with 403', async () => {
    const { agent, board } = await agentWithBoard();
    const { thread } = await createThread(agent, board.slug);
    const other = await app.anonymousAgent();

    const res = await other.authPatch(`/threads/${thread.id}`, { title: 'Hijacked title' });
    expectError(res, 403, 'FORBIDDEN');
  });

  it('refuses pin/lock from a member but allows a moderator', async () => {
    const { agent, board } = await agentWithBoard();
    const { thread } = await createThread(agent, board.slug);
    const moderator = await app.moderatorAgent();

    const forbidden = await agent.authPatch(`/threads/${thread.id}`, { isPinned: true });
    expectError(forbidden, 403, 'FORBIDDEN');

    const pinned = await moderator.authPatch(`/threads/${thread.id}`, { isPinned: true });
    expect(expectSuccess(pinned).thread.isPinned).toBe(true);
  });

  it('soft-deletes an owned thread and removes it from the public list', async () => {
    const { agent, board } = await agentWithBoard();
    const { thread } = await createThread(agent, board.slug);

    const removed = await agent.authDelete(`/threads/${thread.id}`);
    expect(removed.status).toBe(204);

    const list = await app.client().get(app.apiPath('/threads'));
    expect(expectSuccess(list).threads).toHaveLength(0);

    const [stored] = await db.findRaw('threads');
    expect(stored.status).toBe('deleted');
    expect(stored.deletedAt).toBeInstanceOf(Date);

    const detail = await app.client().get(app.apiPath(`/threads/${thread.id}`));
    expectError(detail, 404, 'NOT_FOUND');
  });

  it('returns 404 for a well-formed but unknown id, 400 for a malformed id', async () => {
    const unknown = await app.client().get(app.apiPath('/threads/507f1f77bcf86cd799439011'));
    expectError(unknown, 404, 'NOT_FOUND');

    const malformed = await app.client().get(app.apiPath('/threads/not-an-object-id'));
    expectError(malformed, 400, 'VALIDATION_ERROR');
  });

  it('stores an XSS payload as inert JSON text (no HTML execution surface)', async () => {
    const { agent, board } = await agentWithBoard();
    const payloadBody = '<script>alert("xss")</script> and then some ordinary words here.';
    const res = await agent.authPost('/threads', factories.threadPayload({ boardSlug: board.slug, body: payloadBody }));
    const { thread } = expectSuccess(res);

    const fetched = await app.client().get(app.apiPath(`/threads/${thread.id}`));
    const fetchedThread = expectSuccess(fetched).thread;

    expect(fetched.headers['content-type']).toMatch(/application\/json/);
    const raw = JSON.stringify(fetchedThread);
    expect(raw).not.toContain('<script');
    expect(fetchedThread.body).not.toContain('<script');
    expect(fetchedThread.body.length).toBeGreaterThan(20);
  });

  it('rejects content that violates the spam denylist with 422 CONTENT_BLOCKED', async () => {
    const { agent, board } = await agentWithBoard();
    const res = await agent.authPost(
      '/threads',
      factories.threadPayload({
        boardSlug: board.slug,
        body: 'Click here to win a prize, free crypto giveaway, guaranteed returns for everyone.',
      })
    );
    expectError(res, 422, 'CONTENT_BLOCKED');
  });
});


describe('anonymous authorship display', () => {
  it('never exposes a username for anonymous authors, including legacy aliases', async () => {
    const { agent, board } = await agentWithBoard();

    const { thread } = await createThread(agent, board.slug);
    expect(thread.author.alias).toBe('Anonymous');

    // Simulate a legacy row that still stores a generated "Seeker XXXX" alias on disk.
    const Thread = factories.model('Thread');
    await Thread.updateOne({ _id: thread.id }, { $set: { authorAlias: 'Seeker 9F2A' } });

    const fetched = await agent.get(`/api/v1/threads/${thread.id}`).set('Accept', 'application/json');
    const body = expectSuccess(fetched);
    expect(body.thread.author.alias).toBe('Anonymous');
  });
});
