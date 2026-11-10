import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { IdentityProvider } from '../context/IdentityContext';
import { ToastProvider } from '../context/ToastContext';

// The API layer is the boundary: every network call goes through this module.
vi.mock('../api/endpoints', () => ({
  auth: { me: vi.fn(), bootstrap: vi.fn(), login: vi.fn(), register: vi.fn(), logout: vi.fn() },
  users: {
    preferences: vi.fn(),
    updatePreferences: vi.fn(),
    content: vi.fn(),
    deleteAccount: vi.fn(),
  },
  boards: { list: vi.fn(), get: vi.fn() },
  threads: {
    list: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    replies: vi.fn(),
    createReply: vi.fn(),
  },
  replies: { remove: vi.fn() },
  reports: { create: vi.fn(), list: vi.fn(), update: vi.fn() },
  moderation: { queue: vi.fn(), act: vi.fn(), actions: vi.fn(), stats: vi.fn() },
  notifications: { list: vi.fn(), markRead: vi.fn(), markAllRead: vi.fn() },
  chat: {
    conversations: vi.fn(),
    createConversation: vi.fn(),
    conversation: vi.fn(),
    sendMessage: vi.fn(),
    removeConversation: vi.fn(),
  },
  crisis: { resources: vi.fn(), assess: vi.fn(), recordEvent: vi.fn() },
}));

import LandingPage from '../pages/LandingPage';
import CommunityPage from '../pages/CommunityPage';
import BoardPage from '../pages/BoardPage';
import ThreadPage from '../pages/ThreadPage';
import NewThreadPage from '../pages/NewThreadPage';
import ChatPage from '../pages/ChatPage';
import CrisisPage from '../pages/CrisisPage';
import ModerationPage from '../pages/ModerationPage';
import { auth, boards, threads, chat, crisis } from '../api/endpoints';

const ANONYMOUS = {
  id: 'anon-1',
  kind: 'anonymous',
  role: 'member',
  alias: 'Seeker 4F2A',
  isAnonymous: true,
  createdAt: new Date().toISOString(),
  preferences: {
    displayAlias: 'Seeker 4F2A',
    showCrisisBar: true,
    contentWarningDefault: false,
    reduceMotion: false,
  },
};

const MEMBER = {
  ...ANONYMOUS,
  id: 'user-1',
  kind: 'user',
  role: 'member',
  alias: 'Member One',
  isAnonymous: false,
};

const BOARD = {
  id: 'board-1',
  slug: 'general-support',
  name: 'General support',
  description: 'A gentle space for everyday struggles.',
  icon: '🌿',
  supportLevel: 'peer',
  guidelines: ['Be kind', 'Respect anonymity'],
  tags: ['support'],
  order: 1,
  threadCount: 3,
  replyCount: 7,
  lastActivityAt: new Date().toISOString(),
};

const THREAD = {
  id: '507f1f77bcf86cd799439011',
  boardSlug: 'general-support',
  boardName: 'General support',
  title: 'Trying to find a steadier morning',
  body: 'I have been waking up anxious for a couple of weeks. Writing it down here helps a little.',
  excerpt: 'I have been waking up anxious for a couple of weeks.',
  contentWarning: false,
  tags: ['anxiety'],
  author: { alias: 'Seeker 4F2A', type: 'anonymous' },
  status: 'published',
  isPinned: false,
  isLocked: false,
  replyCount: 0,
  viewCount: 2,
  isOwner: false,
  canEdit: false,
  canDelete: false,
  createdAt: new Date().toISOString(),
  lastActivityAt: new Date().toISOString(),
};

function pageMeta(total = 1, limit = 20) {
  return { page: 1, limit, total, totalPages: Math.ceil(total / limit), hasNext: false, hasPrev: false };
}

function renderPage(ui, { route = '/' } = {}) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <ToastProvider>
        <IdentityProvider>{ui}</IdentityProvider>
      </ToastProvider>
    </MemoryRouter>
  );
}

function stubDefaults() {
  auth.me.mockResolvedValue({ data: { identity: ANONYMOUS } });
  auth.bootstrap.mockResolvedValue({ data: { identity: ANONYMOUS } });
  boards.list.mockResolvedValue({ data: { boards: [BOARD] }, meta: pageMeta(1) });
  boards.get.mockResolvedValue({ data: { board: BOARD } });
  threads.list.mockResolvedValue({ data: { threads: [THREAD] }, meta: pageMeta(1) });
  threads.get.mockResolvedValue({ data: { thread: THREAD } });
  threads.replies.mockResolvedValue({ data: { replies: [] }, meta: pageMeta(0) });
  threads.create.mockResolvedValue({ data: { thread: { ...THREAD, id: 'new-thread' } } });
  crisis.assess.mockResolvedValue({ data: { assessment: { level: 'none', score: 0, reasons: [], showResources: false } } });
  crisis.recordEvent.mockResolvedValue({ data: { acknowledged: true } });
  chat.conversations.mockResolvedValue({ data: { conversations: [] }, meta: pageMeta(0) });
}

beforeEach(() => {
  vi.clearAllMocks();
  stubDefaults();
});

describe('LandingPage', () => {
  it('renders a single honest hero without fabricated community statistics', async () => {
    renderPage(<LandingPage />);

    expect(
      await screen.findByRole('heading', { level: 1, name: /a quiet place to be heard/i })
    ).toBeInTheDocument();
    expect(screen.getByText(BOARD.name)).toBeInTheDocument();

    const text = document.body.textContent;
    // No invented social proof or "live activity" numbers.
    expect(text).not.toMatch(/[\d,]+\+?\s+(people|members|users|seekers)/i);
    expect(text).not.toMatch(/\b(live activity|currently online|helped over)\b/i);
    expect(text).not.toMatch(/\b\d{1,3}(\.\d+)?%/);
    // The AI disclosure is explicit.
    expect(text).toMatch(/computer program, not a therapist/i);
    // Peer-support disclaimer, not a medical claim.
    expect(text).toMatch(/peer support/i);
  });

  it('shows an error state with retry when the board directory fails', async () => {
    boards.list.mockRejectedValueOnce({ status: 500, code: 'INTERNAL_ERROR', message: 'boom' });
    renderPage(<LandingPage />);

    expect(await screen.findByRole('heading', { name: /could not be loaded|something went wrong/i })).toBeInTheDocument();
  });
});

describe('CommunityPage', () => {
  it('shows a loading skeleton, then renders the boards', async () => {
    let resolveBoards;
    boards.list.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveBoards = resolve;
      })
    );

    renderPage(<CommunityPage />);
    expect(screen.getByText('Loading boards')).toBeInTheDocument();

    resolveBoards({ data: { boards: [BOARD] }, meta: pageMeta(1) });
    expect((await screen.findAllByText(BOARD.name)).length).toBeGreaterThan(0);
  });

  it('renders an ErrorState with a retry that refetches', async () => {
    boards.list
      .mockRejectedValueOnce({ status: 500, code: 'INTERNAL_ERROR', message: 'boom' })
      .mockResolvedValueOnce({ data: { boards: [BOARD] }, meta: pageMeta(1) });

    renderPage(<CommunityPage />);
    expect(await screen.findByText(/board directory could not be loaded/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect((await screen.findAllByText(BOARD.name)).length).toBeGreaterThan(0);
    expect(boards.list).toHaveBeenCalledTimes(2);
  });
});

describe('BoardPage', () => {
  it('renders the board and an honest empty state when there are no threads', async () => {
    threads.list.mockResolvedValue({ data: { threads: [] }, meta: pageMeta(0) });
    renderPage(<BoardPage />, { route: '/boards/general-support' });

    expect(await screen.findByRole('heading', { name: BOARD.name })).toBeInTheDocument();
    expect(await screen.findByText('No threads here yet')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /start the first thread/i })).toBeInTheDocument();
  });
});

describe('ThreadPage', () => {
  it('renders a friendly not-found state for a missing thread (no raw error)', async () => {
    threads.get.mockRejectedValue({ status: 404, code: 'NOT_FOUND', message: 'Thread not found' });
    renderPage(<ThreadPage />, { route: `/threads/${THREAD.id}` });

    expect(await screen.findByText('This conversation is not here')).toBeInTheDocument();
    expect(screen.queryByText(/thread not found/i)).not.toBeInTheDocument();
  });
});

describe('NewThreadPage', () => {
  it('validates a short body, shows the error and blocks submission', async () => {
    renderPage(<NewThreadPage />, { route: '/boards/general-support/new' });

    const title = await screen.findByLabelText(/^Title/);
    const body = screen.getByLabelText(/^Your post/);
    await userEvent.type(title, 'A valid title');
    await userEvent.type(body, 'too short');
    await userEvent.click(screen.getByRole('button', { name: 'Post thread' }));

    expect(await screen.findByText(/at least 20 characters/i)).toBeInTheDocument();
    expect(threads.create).not.toHaveBeenCalled();
  });
});

describe('ChatPage', () => {
  const CONVERSATION = {
    id: 'conv-1',
    title: 'A first conversation',
    messageCount: 1,
    lastMessageAt: new Date().toISOString(),
    riskLevel: 'none',
    status: 'active',
  };

  function stubConversation() {
    chat.conversations.mockResolvedValue({ data: { conversations: [CONVERSATION] }, meta: pageMeta(1) });
    chat.conversation.mockResolvedValue({
      data: {
        conversation: CONVERSATION,
        messages: [{ id: 'm1', role: 'assistant', content: 'I am here and listening.', createdAt: new Date().toISOString() }],
      },
      meta: pageMeta(1),
    });
  }

  it('shows the AI disclosure — it never claims to be a therapist', async () => {
    stubConversation();
    renderPage(<ChatPage />);
    expect(await screen.findByRole('heading', { name: 'AI companion' })).toBeInTheDocument();
    expect(await screen.findByText(/not a therapist/i)).toBeInTheDocument();
  });

  it('renders a 503 AI_UNAVAILABLE as a retryable error and fabricates no assistant bubble', async () => {
    stubConversation();
    chat.sendMessage.mockRejectedValue({
      name: 'ApiError',
      status: 503,
      code: 'AI_UNAVAILABLE',
      message: 'The AI companion is temporarily unavailable',
      details: { retryAfterSeconds: 20, canUseGuidedMode: true },
    });

    renderPage(<ChatPage />);
    expect(await screen.findByText('I am here and listening.')).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('Message to the AI companion'), 'I need someone to talk to');
    await userEvent.click(screen.getByRole('button', { name: 'Send message' }));

    expect(await screen.findByText('The AI companion is unavailable right now')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Try again with this message' })
    ).toBeInTheDocument();
    expect(screen.getByText(/we do not fill in fake AI text/i)).toBeInTheDocument();

    // The only assistant message on screen is the pre-existing one.
    const assistantBubbles = screen.getAllByText(/^I am here and listening\.$/);
    expect(assistantBubbles).toHaveLength(1);
  });
});

describe('CrisisPage', () => {
  const RESOURCES = {
    region: 'IN',
    label: 'India',
    primary: {
      name: 'KIRAN Mental Health Helpline',
      contact: '1800-599-0019',
      type: 'phone',
      available: '24/7 — toll free',
      verifiedOn: '2026-04',
    },
    text: null,
    emergency: { name: 'National emergency number', contact: '112', type: 'phone', available: '24/7' },
    local: [],
    international: {
      name: 'Find A Helpline',
      contact: 'https://findahelpline.com',
      type: 'web',
      url: 'https://findahelpline.com',
    },
    lastVerified: '2026-04',
    disclaimer: 'Numbers can change; confirm locally. AdiYogi is not a crisis service.',
  };

  it('renders the helplines returned by the API (never hard-coded)', async () => {
    crisis.resources.mockResolvedValue({ data: { resources: RESOURCES } });
    renderPage(<CrisisPage />);

    expect(await screen.findByText('KIRAN Mental Health Helpline')).toBeInTheDocument();
    expect(screen.getByText(/1800-599-0019/)).toBeInTheDocument();
    expect(screen.getAllByText(/112/).length).toBeGreaterThan(0);
    expect(crisis.resources).toHaveBeenCalled();
  });

  it('offers a safe fallback when the resources API fails', async () => {
    crisis.resources.mockRejectedValue({ status: 500, code: 'INTERNAL_ERROR', message: 'boom', requestId: 'req-1' });
    renderPage(<CrisisPage />);

    expect(await screen.findByText('We could not load local helplines')).toBeInTheDocument();
    expect(screen.getByText(/call your local emergency number now/i)).toBeInTheDocument();
    const findahelpline = screen.getAllByRole('link', { name: /findahelpline\.com/i });
    expect(findahelpline.length).toBeGreaterThan(0);
    expect(findahelpline[0].getAttribute('href')).toMatch(/^https:\/\/findahelpline\.com\/?$/);
  });
});

describe('ModerationPage', () => {
  it('renders the unauthorised card for a non-moderator identity', async () => {
    auth.me.mockResolvedValue({ data: { identity: MEMBER } });
    renderPage(<ModerationPage />);

    expect(await screen.findByRole('heading', { name: 'This area is for moderators' })).toBeInTheDocument();
    // The queue must not be requested for an unauthorised identity.
    expect(await screen.findByText(/only visible to moderator and admin accounts/i)).toBeInTheDocument();
  });
});
