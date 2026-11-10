'use strict';

/**
 * Replies + notifications integration tests (docs/ARCHITECTURE.md §4.3, §12.4).
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

/** Create a board + an author agent + a published thread. */
async function threadFixture() {
  const board = await factories.createBoardRecord({ slug: 'general-support' });
  const author = await app.anonymousAgent();
  const created = await author.authPost('/threads', factories.threadPayload({ boardSlug: board.slug }));
  return {board, author, thread: expectSuccess(created).thread };
}

function reply(agent, threadId, overrides = {}) {
  return agent.authPost(`/threads/${threadId}/replies`, factories.replyPayload(overrides));
}

describe('POST /threads/:id/replies', () => {
  it('creates a reply with the frozen public shape and updates counters', async () => {
    const { author, thread } = await threadFixture();
    const responder = await app.anonymousAgent();

    const res = await reply(responder, thread.id);
    expect(res.status).toBe(201);
    const created = expectSuccess(res).reply;
    expect(created).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        thread: thread.id,
        body: expect.any(String),
        contentWarning: false,
        status: 'published',
        isOwner: true,
        canDelete: true,
      })
    );
    expect(created.author).toEqual({ alias: expect.any(String), type: 'anonymous' });
    expect(created).not.toHaveProperty('authorId');

    const detail = await author.get(app.apiPath(`/threads/${thread.id}`));
    expect(expectSuccess(detail).thread.replyCount).toBe(1);
  });

  it('validates the reply body', async () => {
    const { thread } = await threadFixture();
    const responder = await app.anonymousAgent();

    const tooShort = await reply(responder, thread.id, { body: 'x' });
    expectError(tooShort, 400, 'VALIDATION_ERROR');

    const tooLong = await reply(responder, thread.id, { body: 'y'.repeat(3001) });
    expectError(tooLong, 400, 'VALIDATION_ERROR');
  });

  it('returns 404 for an unknown thread and 400 for a malformed thread id', async () => {
    const responder = await app.anonymousAgent();
    const unknown = await reply(responder, '507f1f77bcf86cd799439011');
    expectError(unknown, 404, 'NOT_FOUND');

    const malformed = await reply(responder, 'not-an-id');
    expectError(malformed, 400, 'VALIDATION_ERROR');
  });

  it('rejects replies on a locked thread with 403', async () => {
    const { thread } = await threadFixture();
    const moderator = await app.moderatorAgent();
    await moderator.authPost('/moderation/actions', {
      action: 'lock',
      targetType: 'thread',
      targetId: thread.id,
    });

    const responder = await app.anonymousAgent();
    const res = await reply(responder, thread.id);
    expectError(res, 403, 'FORBIDDEN');
    expect(await db.countDocuments('replies')).toBe(0);
  });
});

describe('GET /threads/:id/replies', () => {
  it('paginates and sorts replies old/new', async () => {
    const { thread } = await threadFixture();

    const responders = [];
    for (let index = 0; index < 3; index += 1) {
      // eslint-disable-next-line no-await-in-loop
      const responder = await app.anonymousAgent();
      // eslint-disable-next-line no-await-in-loop
      await reply(responder, thread.id, { body: `Reply number ${index} with enough characters.` });
      responders.push(responder);
    }

    const page1 = await app.client().get(app.apiPath(`/threads/${thread.id}/replies?page=1&limit=2&sort=old`));
    const data = expectSuccess(page1);
    expect(data.replies).toHaveLength(2);
    expectPaginationMeta(page1.body.meta, { page: 1, limit: 2, total: 3 });
    expect(data.replies[0].body).toContain('Reply number 0');

    const newest = await app.client().get(app.apiPath(`/threads/${thread.id}/replies?sort=new`));
    expect(expectSuccess(newest).replies[0].body).toContain('Reply number 2');
  });

  it('hides soft-deleted replies from the public list', async () => {
    const { thread } = await threadFixture();
    const responder = await app.anonymousAgent();
    const created = await reply(responder, thread.id);
    const replyId = expectSuccess(created).reply.id;

    const removed = await responder.authDelete(`/replies/${replyId}`);
    expect(removed.status).toBe(204);

    const list = await app.client().get(app.apiPath(`/threads/${thread.id}/replies`));
    expect(expectSuccess(list).replies).toHaveLength(0);

    const [stored] = await db.findRaw('replies');
    expect(stored.status).toBe('deleted');
    expect(stored.deletedAt).toBeInstanceOf(Date);
  });
});

describe('DELETE /replies/:id', () => {
  it('allows the author to delete and decrements the thread replyCount', async () => {
    const { author, thread } = await threadFixture();
    const responder = await app.anonymousAgent();
    const created = await reply(responder, thread.id);
    const replyId = expectSuccess(created).reply.id;

    await responder.authDelete(`/replies/${replyId}`).expect(204);

    const detail = await author.get(app.apiPath(`/threads/${thread.id}`));
    expect(expectSuccess(detail).thread.replyCount).toBe(0);
  });

  it('refuses deletion by another member with 403', async () => {
    const { thread } = await threadFixture();
    const responder = await app.anonymousAgent();
    const created = await reply(responder, thread.id);
    const replyId = expectSuccess(created).reply.id;
    const stranger = await app.anonymousAgent();

    const res = await stranger.authDelete(`/replies/${replyId}`);
    expectError(res, 403, 'FORBIDDEN');
  });

  it('returns 404 for an unknown reply', async () => {
    const agent = await app.anonymousAgent();
    const res = await agent.authDelete('/replies/507f1f77bcf86cd799439011');
    expectError(res, 404, 'NOT_FOUND');
  });
});

describe('notifications', () => {
  it('notifies the thread author when someone replies', async () => {
    const { author, thread } = await threadFixture();
    const responder = await app.anonymousAgent();
    await reply(responder, thread.id);

    expect(await db.countDocuments('notifications')).toBe(1);
    const [notification] = await db.findRaw('notifications');
    expect(notification.type).toBe('thread_reply');
    expect(String(notification.thread)).toBe(thread.id);
    expect(notification.read).toBe(false);
    // Notifications never include reply content (§12.4).
    expect(notification.message).not.toContain('Thank you for sharing');

    const list = await author.get(app.apiPath('/notifications'));
    const data = expectSuccess(list);
    expect(data.notifications).toHaveLength(1);
    expect(data.notifications[0]).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        type: 'thread_reply',
        message: expect.any(String),
        read: false,
      })
    );
    expect(list.body.meta.unreadCount).toBe(1);
    expect(data.notifications[0]).not.toHaveProperty('recipientId');
  });

  it('does not notify the author for their own reply', async () => {
    const { author, thread } = await threadFixture();
    await reply(author, thread.id);
    expect(await db.countDocuments('notifications')).toBe(0);
  });

  it('supports unreadOnly filtering, mark-read and read-all with ownership', async () => {
    const { author, thread } = await threadFixture();
    const responder = await app.anonymousAgent();
    await reply(responder, thread.id);
    await reply(responder, thread.id, { body: 'A second reply from the same person.' });

    const all = await author.get(app.apiPath('/notifications'));
    expect(expectSuccess(all).notifications).toHaveLength(2);

    const unread = await author.get(app.apiPath('/notifications?unreadOnly=true'));
    expect(expectSuccess(unread).notifications).toHaveLength(2);

    const firstId = expectSuccess(all).notifications[0].id;
    const marked = await author.authPatch(`/notifications/${firstId}/read`);
    expect(expectSuccess(marked).notification.read).toBe(true);

    const afterOne = await author.get(app.apiPath('/notifications?unreadOnly=true'));
    expect(expectSuccess(afterOne).notifications).toHaveLength(1);

    const readAll = await author.authPost('/notifications/read-all');
    expect(expectSuccess(readAll).updated).toBe(1);
    expect(await db.countDocuments('notifications', { read: false })).toBe(0);

    // Another session cannot read the author's notifications.
    const stranger = await app.anonymousAgent();
    const forbidden = await stranger.authPatch(`/notifications/${firstId}/read`);
    expectError(forbidden, 404, 'NOT_FOUND');
  });
});
