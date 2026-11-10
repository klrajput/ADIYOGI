'use strict';

/**
 * Chat (AI companion) + crisis integration tests (docs/ARCHITECTURE.md §4.3, §7, §8, §12.4).
 *
 * No real AI provider is ever contacted. The configured path uses the documented test
 * seam `setProviderForTesting`; the unconfigured path (this deployment has no
 * AI_API_KEY) is exercised for real and must return an honest 503 with no persistence.
 */
const db = require('../helpers/db');
const app = require('../helpers/app');
const factories = require('../helpers/factories');
const {
  setProviderForTesting,
  AiProviderError,
  AI_ERROR_CODES,
} = require('../../src/services/ai/provider');
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

const STUB_TEXT = 'Thank you for telling me. That sounds exhausting, and you are not alone.';

function installStubProvider(overrides = {}) {
  setProviderForTesting({
    name: 'stub',
    model: 'stub-model',
    isConfigured: () => true,
    generate: async () => ({ text: STUB_TEXT }),
    ...overrides,
  });
}

async function conversationFor(agent) {
  const res = await agent.authPost('/chat/conversations', factories.conversationPayload());
  return expectSuccess(res).conversation;
}

describe('GET /crisis/resources (§8)', () => {
  it('is public and returns verified helplines for every supported region', async () => {
    for (const country of ['US', 'IN', 'GB', 'CA', 'AU']) {
      // eslint-disable-next-line no-await-in-loop
      const res = await app.client().get(app.apiPath(`/crisis/resources?country=${country}`));
      const { resources } = expectSuccess(res);
      expect(resources.region).toBe(country);
      expect(resources.primary.contact).toBeTruthy();
      expect(resources.emergency.contact).toBeTruthy();
      expect(resources.international.url).toMatch(/findahelpline\.com/);
      expect(resources.lastVerified).toMatch(/^\d{4}-\d{2}$/);
      expect(resources.disclaimer).toMatch(/not a crisis service/i);
    }
  });

  it('falls back to INTL for an unknown region', async () => {
    const res = await app.client().get(app.apiPath('/crisis/resources?country=ZZ'));
    const { resources } = expectSuccess(res);
    expect(resources.region).toBe('INTL');
    expect(resources.primary.contact).toBeTruthy();
  });
});

describe('POST /crisis/assess', () => {
  it('returns a level for high-risk text and stores NOTHING', async () => {
    const agent = await app.anonymousAgent();
    const text = 'I have a plan and I want to kill myself tonight';
    const res = await agent.authPost('/crisis/assess', { text, source: 'assessment' });

    const { assessment } = expectSuccess(res);
    expect(assessment.level).toBe('high');
    expect(assessment.showResources).toBe(true);
    expect(Array.isArray(assessment.reasons)).toBe(true);

    // The text must never be echoed back or persisted (§4.3, §7).
    expect(JSON.stringify(res.body)).not.toContain(text);
    expect(await db.countDocuments('crisisevents')).toBe(0);
  });

  it('returns lower levels for distress-only text', async () => {
    const agent = await app.anonymousAgent();
    const res = await agent.authPost('/crisis/assess', { text: 'I have been feeling sad and overwhelmed' });
    const { assessment } = expectSuccess(res);
    expect(assessment.level).toBe('low');
  });

  it('validates the body', async () => {
    const agent = await app.anonymousAgent();
    const res = await agent.authPost('/crisis/assess', { text: '' });
    expectError(res, 400, 'VALIDATION_ERROR');
  });

  it('requires a session', async () => {
    const res = await app.client().post(app.apiPath('/crisis/assess')).send({ text: 'hello there' });
    expect([401, 403]).toContain(res.status);
  });

  it('is rate limited after 30 assessments per window', async () => {
    const agent = await app.anonymousAgent();
    for (let index = 0; index < 30; index += 1) {
      // eslint-disable-next-line no-await-in-loop
      const res = await agent.authPost('/crisis/assess', { text: 'I am feeling low today' });
      expect(res.status).toBe(200);
    }
    const blocked = await agent.authPost('/crisis/assess', { text: 'I am feeling low today' });
    expectError(blocked, 429, 'RATE_LIMITED');
  }, 30000);
});

describe('POST /crisis/events', () => {
  it('records metadata only and returns resources', async () => {
    const agent = await app.anonymousAgent();
    const res = await agent.authPost('/crisis/events', { level: 'high', source: 'manual', country: 'GB' });
    const data = expectSuccess(res);
    expect(data.acknowledged).toBe(true);
    expect(data.resources.region).toBe('GB');

    const [event] = await db.findRaw('crisisevents');
    expect(event.level).toBe('high');
    expect(event.source).toBe('manual');
    expect(event.country).toBe('GB');
    expect(Object.keys(event)).not.toContain('text');
  });

  it('rejects an invalid level or source', async () => {
    const agent = await app.anonymousAgent();
    expectError(await agent.authPost('/crisis/events', { level: 'none', source: 'manual' }), 400, 'VALIDATION_ERROR');
    expectError(await agent.authPost('/crisis/events', { level: 'high', source: 'guess' }), 400, 'VALIDATION_ERROR');
  });
});

describe('chat — unconfigured provider (honest 503, no fabrication)', () => {
  it('creates conversations but returns 503 AI_UNAVAILABLE on send with nothing persisted', async () => {
    const agent = await app.anonymousAgent();
    const conversation = await conversationFor(agent);

    const res = await agent.authPost(
      `/chat/conversations/${conversation.id}/messages`,
      factories.messagePayload()
    );

    expectError(res, 503, 'AI_UNAVAILABLE');
    const { details } = res.body.error;
    expect(details.canUseGuidedMode).toBe(true);
    expect(details.retryAfterSeconds).toBeGreaterThan(0);
    // AI_FALLBACK_GUIDED=true adds an explicitly non-AI guided exercise (§7).
    expect(details.guidedExercise).toBeTruthy();
    expect(JSON.stringify(details.guidedExercise)).toMatch(/not AI/i);

    // No partial/fabricated turn is persisted.
    expect(await db.countDocuments('chatmessages')).toBe(0);
    const [stored] = await db.findRaw('conversations');
    expect(stored.messageCount).toBe(0);
  });
});

describe('chat — configured provider (via the documented test seam)', () => {
  it('creates, lists and fetches a conversation with persisted messages', async () => {
    installStubProvider();
    const agent = await app.anonymousAgent();
    const conversation = await conversationFor(agent);
    expect(conversation).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        title: expect.any(String),
        messageCount: 0,
        riskLevel: 'none',
        status: 'active',
      })
    );
    expect(conversation).not.toHaveProperty('ownerId');

    const sent = await agent.authPost(
      `/chat/conversations/${conversation.id}/messages`,
      factories.messagePayload()
    );
    const payload = expectSuccess(sent);
    expect(payload.userMessage.role).toBe('user');
    expect(payload.assistantMessage.role).toBe('assistant');
    expect(payload.assistantMessage.content).toBe(STUB_TEXT);
    expect(payload.ai).toEqual({ provider: 'stub', model: 'stub-model', degraded: false });
    expect(['none', 'low']).toContain(payload.risk.level);

    expect(await db.countDocuments('chatmessages')).toBe(2);

    const list = await agent.get(app.apiPath('/chat/conversations'));
    const conversations = expectSuccess(list).conversations;
    expect(conversations).toHaveLength(1);
    expect(list.body.meta.total).toBe(1);

    const fetched = await agent.get(app.apiPath(`/chat/conversations/${conversation.id}`));
    const detail = expectSuccess(fetched);
    expect(detail.conversation.id).toBe(conversation.id);
    expect(detail.messages).toHaveLength(2);
    expect(detail.messages[0].role).toBe('user');
  });

  it('enforces conversation ownership (other session gets 404)', async () => {
    installStubProvider();
    const agent = await app.anonymousAgent();
    const conversation = await conversationFor(agent);
    const other = await app.anonymousAgent();

    expectError(await other.get(app.apiPath(`/chat/conversations/${conversation.id}`)), 404, 'NOT_FOUND');
    expectError(await other.authDelete(`/chat/conversations/${conversation.id}`), 404, 'NOT_FOUND');
    expectError(
      await other.authPost(`/chat/conversations/${conversation.id}/messages`, factories.messagePayload()),
      404,
      'NOT_FOUND'
    );
  });

  it('hard-deletes a conversation and all of its messages', async () => {
    installStubProvider();
    const agent = await app.anonymousAgent();
    const conversation = await conversationFor(agent);
    await agent
      .authPost(`/chat/conversations/${conversation.id}/messages`, factories.messagePayload())
      .expect(200);

    expect(await db.countDocuments('chatmessages')).toBe(2);
    const removed = await agent.authDelete(`/chat/conversations/${conversation.id}`);
    expect(removed.status).toBe(204);
    expect(await db.countDocuments('chatmessages')).toBe(0);
    expect(await db.countDocuments('conversations')).toBe(0);
  });

  it('creates metadata-only crisis events and resources for a high-risk message', async () => {
    installStubProvider();
    const agent = await app.anonymousAgent();
    const conversation = await conversationFor(agent);

    const res = await agent.authPost(`/chat/conversations/${conversation.id}/messages`, {
      content: 'I want to kill myself',
    });
    const payload = expectSuccess(res);
    expect(payload.risk.level).toBe('high');
    expect(payload.resources).toBeTruthy();
    expect(payload.resources.primary.contact).toBeTruthy();
    // A deterministic, server-authored safety message accompanies the AI reply.
    expect(payload.safetyMessage).toBeTruthy();
    expect(payload.safetyMessage.content).toMatch(/crisis|helpline|reach out|support/i);

    expect(await db.countDocuments('crisisevents')).toBe(1);
    const [event] = await db.findRaw('crisisevents');
    expect(event.level).toBe('high');
    expect(event.source).toBe('chat');
    expect(Object.keys(event)).not.toContain('text');
  });

  it('returns 503 AI_UNAVAILABLE and persists nothing when the provider throws', async () => {
    installStubProvider({
      generate: async () => {
        throw new AiProviderError(AI_ERROR_CODES.PROVIDER_ERROR, 'provider unavailable', { retryable: true });
      },
    });
    const agent = await app.anonymousAgent();
    const conversation = await conversationFor(agent);

    const res = await agent.authPost(
      `/chat/conversations/${conversation.id}/messages`,
      factories.messagePayload()
    );
    expectError(res, 503, 'AI_UNAVAILABLE');
    expect(await db.countDocuments('chatmessages')).toBe(0);
    const [stored] = await db.findRaw('conversations');
    expect(stored.messageCount).toBe(0);
  });

  it('treats an empty provider response as a failure (never an empty AI bubble)', async () => {
    installStubProvider({ generate: async () => ({ text: '   ' }) });
    const agent = await app.anonymousAgent();
    const conversation = await conversationFor(agent);

    const res = await agent.authPost(
      `/chat/conversations/${conversation.id}/messages`,
      factories.messagePayload()
    );
    expectError(res, 503, 'AI_UNAVAILABLE');
    expect(await db.countDocuments('chatmessages')).toBe(0);
  });

  it('validates the message body', async () => {
    installStubProvider();
    const agent = await app.anonymousAgent();
    const conversation = await conversationFor(agent);

    expectError(
      await agent.authPost(`/chat/conversations/${conversation.id}/messages`, { content: '' }),
      400,
      'VALIDATION_ERROR'
    );
    expectError(
      await agent.authPost(`/chat/conversations/${conversation.id}/messages`, { content: 'x'.repeat(2001) }),
      400,
      'VALIDATION_ERROR'
    );
  });

  it('is rate limited after 20 messages per window', async () => {
    installStubProvider();
    const agent = await app.anonymousAgent();
    const conversation = await conversationFor(agent);

    for (let index = 0; index < 20; index += 1) {
      // eslint-disable-next-line no-await-in-loop
      const res = await agent.authPost(
        `/chat/conversations/${conversation.id}/messages`,
        factories.messagePayload()
      );
      expect(res.status).toBe(200);
    }
    const blocked = await agent.authPost(
      `/chat/conversations/${conversation.id}/messages`,
      factories.messagePayload()
    );
    expectError(blocked, 429, 'RATE_LIMITED');
  }, 60000);
});
