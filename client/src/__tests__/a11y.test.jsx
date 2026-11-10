import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { IdentityProvider } from '../context/IdentityContext';
import { ToastProvider } from '../context/ToastContext';

vi.mock('../api/endpoints', () => ({
  auth: { me: vi.fn(), bootstrap: vi.fn(), login: vi.fn(), register: vi.fn(), logout: vi.fn() },
  users: { preferences: vi.fn(), updatePreferences: vi.fn(), content: vi.fn(), deleteAccount: vi.fn() },
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

const BOARD = {
  id: 'board-1',
  slug: 'general-support',
  name: 'General support',
  description: 'A gentle space for everyday struggles.',
  icon: '🌿',
  supportLevel: 'peer',
  guidelines: ['Be kind'],
  tags: ['support'],
  order: 1,
  threadCount: 1,
  replyCount: 0,
  lastActivityAt: new Date().toISOString(),
};

const CONVERSATION = {
  id: 'conv-1',
  title: 'A conversation',
  messageCount: 1,
  lastMessageAt: new Date().toISOString(),
  riskLevel: 'none',
  status: 'active',
};

const meta = (total = 1) => ({ page: 1, limit: 20, total, totalPages: 1, hasNext: false, hasPrev: false });

function renderPage(ui, { route = '/' } = {}) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <ToastProvider>
        <IdentityProvider>{ui}</IdentityProvider>
      </ToastProvider>
    </MemoryRouter>
  );
}

function expectSingleH1() {
  const headings = screen.getAllByRole('heading', { level: 1 });
  expect(headings).toHaveLength(1);
  expect(headings[0].textContent.trim().length).toBeGreaterThan(0);
}

/** Every button must have a discernible name (text or aria-label). */
function expectButtonsNamed() {
  const buttons = screen.getAllByRole('button');
  buttons.forEach((button) => {
    const name = button.getAttribute('aria-label') || button.textContent.trim();
    expect(name.length).toBeGreaterThan(0);
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  auth.me.mockResolvedValue({ data: { identity: ANONYMOUS } });
  auth.bootstrap.mockResolvedValue({ data: { identity: ANONYMOUS } });
  boards.list.mockResolvedValue({ data: { boards: [BOARD] }, meta: meta(1) });
  boards.get.mockResolvedValue({ data: { board: BOARD } });
  threads.list.mockResolvedValue({ data: { threads: [] }, meta: meta(0) });
  threads.replies.mockResolvedValue({ data: { replies: [] }, meta: meta(0) });
  crisis.assess.mockResolvedValue({ data: { assessment: { level: 'none', score: 0, reasons: [], showResources: false } } });
  crisis.resources.mockResolvedValue({
    data: {
      resources: {
        region: 'US',
        label: 'United States',
        primary: { name: '988 Suicide & Crisis Lifeline', contact: '988', type: 'phone', available: '24/7' },
        text: null,
        emergency: { name: 'Emergency services', contact: '911', type: 'phone', available: '24/7' },
        local: [],
        international: { name: 'Find A Helpline', contact: 'findahelpline.com', url: 'https://findahelpline.com' },
        lastVerified: '2026-04',
        disclaimer: 'Confirm locally.',
      },
    },
  });
  chat.conversations.mockResolvedValue({ data: { conversations: [CONVERSATION] }, meta: meta(1) });
  chat.conversation.mockResolvedValue({
    data: { conversation: CONVERSATION, messages: [] },
    meta: meta(0),
  });
});

describe('accessibility: structure', () => {
  it('LandingPage has exactly one h1 and a visible crisis affordance link', async () => {
    renderPage(<LandingPage />);
    await screen.findByRole('heading', { level: 1 });
    expectSingleH1();
    expect(screen.getAllByRole('link', { name: /get help now/i }).length).toBeGreaterThan(0);
  });

  it('CommunityPage has exactly one h1', async () => {
    renderPage(<CommunityPage />);
    await screen.findByText(BOARD.name);
    expectSingleH1();
  });

  it('ChatPage has exactly one h1 and visible AI disclosure in a note', async () => {
    renderPage(<ChatPage />);
    await screen.findByRole('heading', { name: 'AI companion' });
    expectSingleH1();
    expect(screen.getByRole('note')).toHaveTextContent(/not a therapist/i);
  });

  it('CrisisPage has exactly one h1 and the crisis regions are labelled sections', async () => {
    renderPage(<CrisisPage />);
    await screen.findByRole('heading', { name: 'Get help right now' });
    expectSingleH1();
    expect(screen.getByRole('region', { name: /verified helplines/i })).toBeInTheDocument();
  });

  it('ModerationPage unauthorised card has exactly one h1', async () => {
    renderPage(<ModerationPage />);
    await screen.findByRole('heading', { name: 'This area is for moderators' });
    expectSingleH1();
  });
});

describe('accessibility: forms and controls', () => {
  it('NewThreadPage form controls have accessible labels', async () => {
    renderPage(<NewThreadPage />, { route: '/boards/general-support/new' });
    expect(await screen.findByLabelText(/^Title/)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Your post/)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Tags/)).toBeInTheDocument();
    expectButtonsNamed();
  });

  it('ChatPage composer has an accessible label and a named send control', async () => {
    renderPage(<ChatPage />);
    expect(await screen.findByLabelText('Message to the AI companion')).toBeInTheDocument();
    expectButtonsNamed();
  });

  it('icon-only controls on the crisis screen expose accessible names', async () => {
    renderPage(<CrisisPage />);
    await screen.findByRole('heading', { name: 'Get help right now' });
    expectButtonsNamed();
  });
});

describe('accessibility: async regions', () => {
  it('exposes an aria-live region for toasts/async status', async () => {
    renderPage(<LandingPage />);
    await screen.findByRole('heading', { level: 1 });
    const liveRegions = document.querySelectorAll('[aria-live]');
    expect(liveRegions.length).toBeGreaterThan(0);
  });

  it('error states are announced with role="alert"', async () => {
    boards.list.mockRejectedValueOnce({ status: 500, code: 'INTERNAL_ERROR', message: 'boom' });
    renderPage(<CommunityPage />);
    const alert = await screen.findByRole('alert');
    expect(alert).toBeInTheDocument();
    // No raw stack trace or internal id is surfaced to the user.
    expect(alert.textContent).not.toMatch(/at \w+ \(|Mongo|stack/i);
  });
});
