'use strict';

/**
 * Moderation + reports integration tests (docs/ARCHITECTURE.md §4.3, §6.4, §12.4).
 * The authorization matrix and the audit trail are contractual, so they are asserted
 * end-to-end through the real API.
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

async function forumFixture() {
  const board = await factories.createBoardRecord({ slug: 'general-support' });
  const author = await app.anonymousAgent();
  const created = await author.authPost('/threads', factories.threadPayload({ boardSlug: board.slug }));
  const thread = expectSuccess(created).thread;

  const responder = await app.anonymousAgent();
  const replyCreated = await responder.authPost(
    `/threads/${thread.id}/replies`,
    factories.replyPayload()
  );
  const reply = expectSuccess(replyCreated).reply;

  const reporter = await app.anonymousAgent();
  const reportCreated = await reporter.authPost('/reports', {
    targetType: 'reply',
    targetId: reply.id,
    reason: 'harassment',
    details: 'This reply contains personal attacks.',
  });
  const report = expectSuccess(reportCreated).report;

  return { board, thread, reply, report, author, responder, reporter };
}

describe('authorization matrix (§6.4)', () => {
  const memberEndpoints = [
    ['get', '/moderation/queue'],
    ['get', '/moderation/actions'],
    ['get', '/moderation/stats'],
    ['get', '/reports'],
  ];

  it.each(memberEndpoints)('refuses %s %s to a member account', async (method, path) => {
    const member = await app.memberAgent();
    const res = await member[method](app.apiPath(path));
    expectError(res, 403, 'FORBIDDEN');
  });

  it('refuses moderation endpoints to anonymous sessions (403 FORBIDDEN)', async () => {
    // Anonymous sessions are authenticated identities with role 'member' (§6.1/§6.4),
    // so the refusal is 403 FORBIDDEN, not 401.
    const anonymous = await app.anonymousAgent();
    const res = await anonymous.get(app.apiPath('/moderation/queue'));
    expectError(res, 403, 'FORBIDDEN');
  });

  it('allows moderators to read the queue, audit log and stats', async () => {
    const moderator = await app.moderatorAgent();
    for (const path of ['/moderation/queue', '/moderation/actions', '/moderation/stats', '/reports']) {
      // eslint-disable-next-line no-await-in-loop
      const res = await moderator.get(app.apiPath(path));
      expectSuccess(res);
    }
  });

  it('keeps board management admin-only (moderator refused, admin allowed)', async () => {
    const moderator = await app.moderatorAgent();
    const admin = await app.adminAgent();
    const payload = factories.boardPayload();

    const refused = await moderator.authPost('/boards', payload);
    expectError(refused, 403, 'FORBIDDEN');

    const allowed = await admin.authPost('/boards', payload);
    expect(allowed.status).toBe(201);
  });
});

describe('POST /reports', () => {
  it('creates a report from a session', async () => {
    const { report } = await forumFixture();
    expect(report).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        targetType: 'reply',
        reason: 'harassment',
        status: 'open',
        // §12.7 requires the isOwner field on the public Report shape.
        isOwner: expect.any(Boolean),
      })
    );
    expect(report).not.toHaveProperty('reportedBy');
  });

  it('rejects a duplicate report for the same target with 409', async () => {
    const { reply } = await forumFixture();
    const member = await app.memberAgent();
    const payload = { targetType: 'reply', targetId: reply.id, reason: 'spam' };
    await member.authPost('/reports', payload).expect(201);

    const duplicate = await member.authPost('/reports', payload);
    expectError(duplicate, 409, 'CONFLICT');
  });

  it('rejects reporting your own content with 400', async () => {
    const { author, thread } = await forumFixture();
    const res = await author.authPost('/reports', {
      targetType: 'thread',
      targetId: thread.id,
      reason: 'other',
    });
    expectError(res, 400, 'VALIDATION_ERROR');
  });

  it('returns 404 for an unknown target id', async () => {
    const reporter = await app.anonymousAgent();
    const res = await reporter.authPost('/reports', {
      targetType: 'reply',
      targetId: '507f1f77bcf86cd799439011',
      reason: 'spam',
    });
    expectError(res, 404, 'NOT_FOUND');
  });

  it('validates the report reason enum', async () => {
    const { reply } = await forumFixture();
    const reporter = await app.anonymousAgent();
    const res = await reporter.authPost('/reports', {
      targetType: 'reply',
      targetId: reply.id,
      reason: 'not-a-real-reason',
    });
    expectError(res, 400, 'VALIDATION_ERROR');
  });
});

describe('moderation queue and actions', () => {
  it('shows the open report in the queue', async () => {
    const { report } = await forumFixture();
    const moderator = await app.moderatorAgent();
    const res = await moderator.get(app.apiPath('/moderation/queue'));
    const data = expectSuccess(res);
    expect(Array.isArray(data.reports)).toBe(true);
    expect(data.reports.some((entry) => entry.id === report.id)).toBe(true);
    expect(data).toHaveProperty('hiddenThreads');
    expect(data).toHaveProperty('hiddenReplies');
  });

  it('hides a thread: public list excludes it, moderators still see it, queue lists it', async () => {
    const { thread } = await forumFixture();
    const moderator = await app.moderatorAgent();

    const action = await moderator.authPost('/moderation/actions', {
      action: 'hide',
      targetType: 'thread',
      targetId: thread.id,
      reason: 'Breaks the community guidelines',
    });
    expect(action.status).toBe(201);
    const audit = expectSuccess(action).moderationAction;
    expect(audit).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        action: 'hide',
        targetType: 'thread',
        targetId: thread.id,
        moderator: expect.objectContaining({ id: expect.any(String) }),
      })
    );

    const publicList = await app.client().get(app.apiPath('/threads'));
    expect(expectSuccess(publicList).threads.map((entry) => entry.id)).not.toContain(thread.id);

    const moderatorList = await moderator.get(app.apiPath('/threads'));
    const hidden = expectSuccess(moderatorList).threads.find((entry) => entry.id === thread.id);
    expect(hidden).toBeDefined();
    expect(hidden.status).toBe('hidden');

    const queue = await moderator.get(app.apiPath('/moderation/queue'));
    const queueData = expectSuccess(queue);
    expect(queueData.hiddenThreads.map((entry) => entry.id)).toContain(thread.id);
  });

  it('hides a reply: it disappears from the public reply list', async () => {
    const { thread, reply } = await forumFixture();
    const moderator = await app.moderatorAgent();

    await moderator
      .authPost('/moderation/actions', {
        action: 'hide',
        targetType: 'reply',
        targetId: reply.id,
        reason: 'Abusive reply',
      })
      .expect(201);

    const list = await app.client().get(app.apiPath(`/threads/${thread.id}/replies`));
    expect(expectSuccess(list).replies).toHaveLength(0);

    const queue = await moderator.get(app.apiPath('/moderation/queue'));
    expect(expectSuccess(queue).hiddenReplies.map((entry) => entry.id)).toContain(reply.id);
  });

  it('unhides content back to published', async () => {
    const { thread } = await forumFixture();
    const moderator = await app.moderatorAgent();

    await moderator
      .authPost('/moderation/actions', {
        action: 'hide',
        targetType: 'thread',
        targetId: thread.id,
        reason: 'Temporary hide',
      })
      .expect(201);

    const unhide = await moderator.authPost('/moderation/actions', {
      action: 'unhide',
      targetType: 'thread',
      targetId: thread.id,
    });
    expect(expectSuccess(unhide).target.status).toBe('published');

    const publicList = await app.client().get(app.apiPath('/threads'));
    expect(expectSuccess(publicList).threads.map((entry) => entry.id)).toContain(thread.id);
  });

  it('deletes content and records the audit entry', async () => {
    const { thread } = await forumFixture();
    const moderator = await app.moderatorAgent();

    await moderator
      .authPost('/moderation/actions', {
        action: 'delete',
        targetType: 'thread',
        targetId: thread.id,
        reason: 'Removed after review',
      })
      .expect(201);

    const [stored] = await db.findRaw('threads');
    expect(stored.status).toBe('deleted');
    expect(await db.countDocuments('moderationactions', { action: 'delete' })).toBe(1);
  });

  it('pins and locks threads; locked threads reject new replies', async () => {
    const { thread } = await forumFixture();
    const moderator = await app.moderatorAgent();

    const pin = await moderator.authPost('/moderation/actions', {
      action: 'pin',
      targetType: 'thread',
      targetId: thread.id,
    });
    expect(expectSuccess(pin).target.isPinned).toBe(true);

    const list = await app.client().get(app.apiPath('/threads'));
    expect(expectSuccess(list).threads[0].id).toBe(thread.id);

    const lock = await moderator.authPost('/moderation/actions', {
      action: 'lock',
      targetType: 'thread',
      targetId: thread.id,
    });
    expect(expectSuccess(lock).target.isLocked).toBe(true);

    const responder = await app.anonymousAgent();
    const blocked = await responder.authPost(`/threads/${thread.id}/replies`, factories.replyPayload());
    expectError(blocked, 403, 'FORBIDDEN');

    const unlock = await moderator.authPost('/moderation/actions', {
      action: 'unlock',
      targetType: 'thread',
      targetId: thread.id,
    });
    expect(expectSuccess(unlock).target.isLocked).toBe(false);

    const allowed = await responder.authPost(`/threads/${thread.id}/replies`, factories.replyPayload());
    expect(allowed.status).toBe(201);
  });

  it('rejects incompatible action/target combinations with 400', async () => {
    const { reply } = await forumFixture();
    const moderator = await app.moderatorAgent();

    for (const action of ['pin', 'lock']) {
      // eslint-disable-next-line no-await-in-loop
      const res = await moderator.authPost('/moderation/actions', {
        action,
        targetType: 'reply',
        targetId: reply.id,
      });
      expectError(res, 400, 'VALIDATION_ERROR');
    }
  });

  it('requires a written reason for hide and delete', async () => {
    const { thread } = await forumFixture();
    const moderator = await app.moderatorAgent();
    const res = await moderator.authPost('/moderation/actions', {
      action: 'hide',
      targetType: 'thread',
      targetId: thread.id,
    });
    expectError(res, 400, 'VALIDATION_ERROR');
  });

  it('returns 404 for unknown moderation targets', async () => {
    const moderator = await app.moderatorAgent();
    const res = await moderator.authPost('/moderation/actions', {
      action: 'hide',
      targetType: 'thread',
      targetId: '507f1f77bcf86cd799439011',
      reason: 'Unknown target',
    });
    expectError(res, 404, 'NOT_FOUND');
  });

  it('resolves a report through PATCH /reports/:id and drops it from the queue', async () => {
    const { report } = await forumFixture();
    const moderator = await app.moderatorAgent();

    const resolved = await moderator.authPatch(`/reports/${report.id}`, {
      status: 'resolved',
      resolutionNote: 'Reviewed and actioned',
    });
    expect(expectSuccess(resolved).report.status).toBe('resolved');

    const queue = await moderator.get(app.apiPath('/moderation/queue'));
    expect(expectSuccess(queue).reports.map((entry) => entry.id)).not.toContain(report.id);
  });

  it('records every moderation action in the paginated audit log', async () => {
    const { thread, reply } = await forumFixture();
    const moderator = await app.moderatorAgent();

    await moderator
      .authPost('/moderation/actions', {
        action: 'hide',
        targetType: 'reply',
        targetId: reply.id,
        reason: 'Abusive reply',
      })
      .expect(201);
    await moderator
      .authPost('/moderation/actions', {
        action: 'pin',
        targetType: 'thread',
        targetId: thread.id,
      })
      .expect(201);
    await moderator
      .authPost('/moderation/actions', {
        action: 'lock',
        targetType: 'thread',
        targetId: thread.id,
      })
      .expect(201);

    const log = await moderator.get(app.apiPath('/moderation/actions?page=1&limit=10'));
    const data = expectSuccess(log);
    expect(data.actions.length).toBe(3);
    expectPaginationMeta(log.body.meta, { page: 1, limit: 10, total: 3 });
    expect(data.actions.map((entry) => entry.action).sort()).toEqual(['hide', 'lock', 'pin']);
    expect(data.actions[0].moderator).toEqual(
      expect.objectContaining({ id: expect.any(String), displayName: expect.any(String) })
    );

    const filtered = await moderator.get(app.apiPath('/moderation/actions?action=hide'));
    expect(expectSuccess(filtered).actions).toHaveLength(1);
  });

  it('exposes aggregate stats with the documented shape', async () => {
    await forumFixture();
    const moderator = await app.moderatorAgent();

    const res = await moderator.get(app.apiPath('/moderation/stats'));
    const { stats } = expectSuccess(res);
    expect(stats).toEqual(
      expect.objectContaining({
        openReports: 1,
        reportsToday: expect.any(Number),
        hiddenThreads: expect.any(Number),
        hiddenReplies: expect.any(Number),
        crisisEvents30d: expect.any(Number),
        threadsToday: expect.any(Number),
        repliesToday: expect.any(Number),
      })
    );
    // Stats must never expose content or identities.
    expect(JSON.stringify(stats)).not.toContain('@');
  });
});

describe('reports listing', () => {
  it('lists reports for moderators with status filtering and pagination meta', async () => {
    const { report } = await forumFixture();
    const moderator = await app.moderatorAgent();

    const list = await moderator.get(app.apiPath('/reports?status=open'));
    const data = expectSuccess(list);
    expect(data.reports.map((entry) => entry.id)).toContain(report.id);
    expectPaginationMeta(list.body.meta, { page: 1, total: 1 });

    const resolved = await moderator.get(app.apiPath('/reports?status=resolved'));
    expect(expectSuccess(resolved).reports).toHaveLength(0);
  });
});
