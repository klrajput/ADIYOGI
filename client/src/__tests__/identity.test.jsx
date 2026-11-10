import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { IdentityProvider, useIdentity } from '../context/IdentityContext';

// The API layer is the boundary: mock it, never the context under test.
vi.mock('../api/endpoints', () => ({
  auth: {
    me: vi.fn(),
    bootstrap: vi.fn(),
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
  },
  users: {
    updatePreferences: vi.fn(),
  },
}));

import { auth, users } from '../api/endpoints';

const ANONYMOUS = {
  id: 'anon-session-1',
  kind: 'anonymous',
  role: 'member',
  alias: 'Seeker 4F2A',
  isAnonymous: true,
  preferences: {
    displayAlias: 'Seeker 4F2A',
    showCrisisBar: true,
    contentWarningDefault: false,
    reduceMotion: false,
  },
};

const MEMBER = {
  id: 'user-1',
  kind: 'user',
  role: 'member',
  alias: 'Member One',
  isAnonymous: false,
  preferences: {
    displayAlias: 'Member One',
    showCrisisBar: true,
    contentWarningDefault: false,
    reduceMotion: false,
  },
};

function Probe() {
  const {
    identity,
    loading,
    isAnonymous,
    isAuthenticated,
    isModerator,
    isAdmin,
    updatePreferences,
    logout,
    login,
  } = useIdentity();

  return (
    <div>
      <p data-testid="loading">{loading ? 'loading' : 'ready'}</p>
      <p data-testid="alias">{identity ? identity.alias : 'none'}</p>
      <p data-testid="kind">{identity ? identity.kind : 'none'}</p>
      <p data-testid="display-alias">{identity?.preferences?.displayAlias ?? 'none'}</p>
      <p data-testid="reduce-motion">{String(identity?.preferences?.reduceMotion ?? 'none')}</p>
      <p data-testid="flags">
        {`anon=${isAnonymous} auth=${isAuthenticated} mod=${isModerator} admin=${isAdmin}`}
      </p>
      <button type="button" onClick={() => updatePreferences({ displayAlias: 'New Alias', reduceMotion: true })}>
        update preferences
      </button>
      <button type="button" onClick={() => logout()}>
        log out
      </button>
      <button type="button" onClick={() => login({ email: 'a@b.c', password: 'x' })}>
        log in
      </button>
    </div>
  );
}

function renderProvider() {
  return render(
    <IdentityProvider>
      <Probe />
    </IdentityProvider>
  );
}

function unauthorised() {
  const error = new Error('Unauthenticated');
  error.status = 401;
  error.code = 'UNAUTHENTICATED';
  return error;
}

describe('IdentityProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('bootstraps an anonymous session when /auth/me returns 401', async () => {
    auth.me.mockRejectedValue(unauthorised());
    auth.bootstrap.mockResolvedValue({ data: { identity: ANONYMOUS } });

    renderProvider();

    expect(screen.getByTestId('loading')).toHaveTextContent('loading');
    await waitFor(() => expect(screen.getByTestId('kind')).toHaveTextContent('anonymous'));
    expect(screen.getByTestId('alias')).toHaveTextContent('Seeker 4F2A');
    expect(screen.getByTestId('loading')).toHaveTextContent('ready');
    expect(auth.bootstrap).toHaveBeenCalledTimes(1);
  });

  it('reuses an existing session without bootstrapping a new one', async () => {
    auth.me.mockResolvedValue({ data: { identity: MEMBER } });

    renderProvider();

    await waitFor(() => expect(screen.getByTestId('kind')).toHaveTextContent('user'));
    expect(auth.me).toHaveBeenCalledTimes(1);
    expect(auth.bootstrap).not.toHaveBeenCalled();
    expect(screen.getByTestId('flags')).toHaveTextContent('anon=false auth=true mod=false admin=false');
  });

  it('derives moderator/admin capability flags from the server-issued role', async () => {
    auth.me.mockResolvedValue({ data: { identity: { ...MEMBER, role: 'admin' } } });
    renderProvider();
    await waitFor(() => expect(screen.getByTestId('flags')).toHaveTextContent('mod=true admin=true'));

    vi.clearAllMocks();
    auth.me.mockResolvedValue({ data: { identity: { ...MEMBER, role: 'moderator' } } });
    renderProvider();
    await waitFor(() => expect(screen.getAllByTestId('flags')[1]).toHaveTextContent('mod=true admin=false'));
  });

  it('updatePreferences merges the persisted preferences into identity', async () => {
    auth.me.mockResolvedValue({ data: { identity: ANONYMOUS } });
    users.updatePreferences.mockResolvedValue({
      data: { preferences: { ...ANONYMOUS.preferences, displayAlias: 'New Alias', reduceMotion: true } },
    });

    renderProvider();
    await waitFor(() => expect(screen.getByTestId('display-alias')).toHaveTextContent('Seeker 4F2A'));

    await userEvent.click(screen.getByRole('button', { name: 'update preferences' }));

    await waitFor(() => expect(screen.getByTestId('display-alias')).toHaveTextContent('New Alias'));
    expect(screen.getByTestId('reduce-motion')).toHaveTextContent('true');
    expect(users.updatePreferences).toHaveBeenCalledWith({ displayAlias: 'New Alias', reduceMotion: true });
    // Unchanged preference fields survive the merge.
    expect(screen.getByTestId('flags')).toHaveTextContent('auth=true');
  });

  it('logout revokes the session and re-bootstraps an anonymous identity', async () => {
    auth.me.mockResolvedValue({ data: { identity: MEMBER } });
    auth.logout.mockResolvedValue({ data: {} });
    const anonymousAfterLogout = { ...ANONYMOUS, alias: 'Seeker NEW1' };
    auth.bootstrap.mockResolvedValue({ data: { identity: anonymousAfterLogout } });

    renderProvider();
    await waitFor(() => expect(screen.getByTestId('kind')).toHaveTextContent('user'));

    await userEvent.click(screen.getByRole('button', { name: 'log out' }));

    await waitFor(() => expect(screen.getByTestId('kind')).toHaveTextContent('anonymous'));
    expect(screen.getByTestId('alias')).toHaveTextContent('Seeker NEW1');
    expect(auth.logout).toHaveBeenCalledTimes(1);
    expect(auth.bootstrap).toHaveBeenCalledTimes(1);
  });

  it('login replaces the identity with the account identity', async () => {
    auth.me.mockRejectedValue(unauthorised());
    auth.bootstrap.mockResolvedValue({ data: { identity: ANONYMOUS } });
    auth.login.mockResolvedValue({ data: { identity: MEMBER } });

    renderProvider();
    await waitFor(() => expect(screen.getByTestId('kind')).toHaveTextContent('anonymous'));

    await userEvent.click(screen.getByRole('button', { name: 'log in' }));
    await waitFor(() => expect(screen.getByTestId('kind')).toHaveTextContent('user'));
    expect(screen.getByTestId('alias')).toHaveTextContent('Member One');
  });
});
