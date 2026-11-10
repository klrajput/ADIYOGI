import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, ApiError, API_BASE_URL, clearCsrfTokenCache } from '../api/client';

/**
 * API client contract (docs/ARCHITECTURE.md §12.6).
 * `global.fetch` is replaced with a controllable double: this is the network boundary,
 * not the module under test, so the client's real parsing/retry/CSRF logic runs.
 */

function jsonResponse(status, body, headers = {}) {
  const lower = Object.fromEntries(Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]));
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name) => lower[String(name).toLowerCase()] ?? null },
    text: async () => (body === undefined ? '' : JSON.stringify(body)),
  };
}

function emptyResponse(status) {
  return { ok: true, status, headers: { get: () => null }, text: async () => '' };
}

const envelope = (data, meta = {}, message = 'OK') => ({ success: true, message, data, meta });

describe('apiClient envelope handling', () => {
  let fetchMock;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    clearCsrfTokenCache();
    document.cookie = 'ay_csrf=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.cookie = 'ay_csrf=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
  });

  it('unwraps the success envelope for GET and sends credentials', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, envelope({ boards: [{ id: 'b1' }] }, { page: 1, total: 1 }))
    );

    const result = await api.get('/boards');

    expect(result.data).toEqual({ boards: [{ id: 'b1' }] });
    expect(result.meta).toEqual({ page: 1, total: 1 });
    expect(result.message).toBe('OK');

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API_BASE_URL}/boards`);
    expect(options.method).toBe('GET');
    expect(options.credentials).toBe('include');
    expect(options.headers.Accept).toBe('application/json');
  });

  it('serialises query params and drops empty values', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, envelope([])));

    await api.get('/threads', {
      query: { page: 2, limit: 20, q: 'anxiety', tag: ['a', 'b'], skipped: undefined, empty: '' },
    });

    const [url] = fetchMock.mock.calls[0];
    const parsed = new URL(url, 'http://localhost');
    expect(parsed.pathname).toBe('/api/v1/threads');
    expect(parsed.searchParams.get('page')).toBe('2');
    expect(parsed.searchParams.get('limit')).toBe('20');
    expect(parsed.searchParams.get('q')).toBe('anxiety');
    expect(parsed.searchParams.getAll('tag')).toEqual(['a', 'b']);
    expect(parsed.searchParams.has('skipped')).toBe(false);
    expect(parsed.searchParams.has('empty')).toBe(false);
  });

  it('sends the CSRF header on POST, read from the ay_csrf cookie', async () => {
    document.cookie = 'ay_csrf=signed-token-value; path=/';
    fetchMock.mockResolvedValueOnce(jsonResponse(201, envelope({ id: 't1' })));

    await api.post('/threads', { title: 'Hello', body: 'World' });

    const [, options] = fetchMock.mock.calls[0];
    expect(options.method).toBe('POST');
    expect(options.headers['x-csrf-token']).toBe('signed-token-value');
    expect(options.headers['Content-Type']).toBe('application/json');
    expect(options.body).toBe(JSON.stringify({ title: 'Hello', body: 'World' }));
  });

  it('does not send a CSRF header on GET', async () => {
    document.cookie = 'ay_csrf=signed-token-value; path=/';
    fetchMock.mockResolvedValueOnce(jsonResponse(200, envelope({})));

    await api.get('/auth/me');

    const [, options] = fetchMock.mock.calls[0];
    expect(options.headers['x-csrf-token']).toBeUndefined();
  });

  it('sends the CSRF header on PATCH and DELETE too', async () => {
    document.cookie = 'ay_csrf=token-123; path=/';
    fetchMock.mockResolvedValueOnce(jsonResponse(200, envelope({})));
    await api.patch('/users/me/preferences', { reduceMotion: true });
    expect(fetchMock.mock.calls[0][1].headers['x-csrf-token']).toBe('token-123');

    fetchMock.mockResolvedValueOnce(emptyResponse(204));
    await api.delete('/notifications/read-all');
    expect(fetchMock.mock.calls[1][1].method).toBe('DELETE');
    expect(fetchMock.mock.calls[1][1].headers['x-csrf-token']).toBe('token-123');
  });

  it('returns {data:null, meta:null} for 204 responses', async () => {
    fetchMock.mockResolvedValueOnce(emptyResponse(204));
    const result = await api.delete('/threads/t1');
    expect(result).toEqual({ data: null, meta: null });
  });

  it('throws a typed ApiError with status/code/message/details/requestId', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        404,
        {
          success: false,
          message: 'Thread not found',
          error: { code: 'NOT_FOUND', details: { threadId: 'missing' } },
          requestId: 'req-from-body',
        },
        { 'x-request-id': 'req-from-header' }
      )
    );

    await expect(api.get('/threads/missing')).rejects.toMatchObject({
      name: 'ApiError',
      status: 404,
      code: 'NOT_FOUND',
      message: 'Thread not found',
      details: { threadId: 'missing' },
      requestId: 'req-from-body',
    });
  });

  it('falls back to the x-request-id header when the body omits it', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(409, { success: false, message: 'Duplicate', error: { code: 'CONFLICT' } }, { 'x-request-id': 'hdr-1' })
    );

    await expect(api.post('/reports', {})).rejects.toMatchObject({ status: 409, requestId: 'hdr-1' });
  });

  it('throws a typed network ApiError when fetch rejects twice (GET retries once)', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));

    await expect(api.get('/boards')).rejects.toSatisfy((error) => {
      expect(error).toBeInstanceOf(ApiError);
      expect(error.status).toBe(0);
      expect(error.code).toBe('NETWORK_ERROR');
      expect(error.isNetworkError).toBe(true);
      expect(error.message).toMatch(/could not reach/i);
      return true;
    });
  });

  it('handles a non-JSON error body without crashing', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 502,
      headers: { get: () => null },
      text: async () => '<html>Bad gateway</html>',
    });

    await expect(api.get('/boards')).rejects.toMatchObject({ status: 502, code: 'INTERNAL_ERROR' });
  });
});

describe('apiClient 401 session recovery', () => {
  let fetchMock;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    clearCsrfTokenCache();
    document.cookie = 'ay_csrf=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('bootstraps an anonymous session and retries the original request exactly once', async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse(401, { success: false, message: 'Unauthenticated', error: { code: 'UNAUTHENTICATED' } })
      )
      // Bootstrap order: GET /auth/csrf first (refresh-cookie reloads are CSRF-gated),
      // then POST /auth/session.
      .mockResolvedValueOnce(jsonResponse(200, envelope({ csrfToken: 'signed.csrf' })))
      .mockResolvedValueOnce(
        jsonResponse(200, envelope({ identity: { kind: 'anonymous' }, csrfToken: 'signed.csrf' }))
      )
      .mockResolvedValueOnce(jsonResponse(200, envelope({ threads: [] })));

    const result = await api.get('/threads');

    expect(result.data).toEqual({ threads: [] });
    expect(fetchMock).toHaveBeenCalledTimes(4);

    const [csrfUrl, csrfOptions] = fetchMock.mock.calls[1];
    expect(csrfUrl).toBe(`${API_BASE_URL}/auth/csrf`);
    expect(csrfOptions.method).toBe('GET');

    const [sessionUrl, sessionOptions] = fetchMock.mock.calls[2];
    expect(sessionUrl).toBe(`${API_BASE_URL}/auth/session`);
    expect(sessionOptions.method).toBe('POST');

    const [retryUrl, retryOptions] = fetchMock.mock.calls[3];
    expect(retryUrl).toBe(`${API_BASE_URL}/threads`);
    expect(retryOptions.method).toBe('GET');
  });

  it('does not bootstrap-loop: a second 401 is thrown', async () => {
    const unauth = () =>
      jsonResponse(401, { success: false, message: 'Unauthenticated', error: { code: 'UNAUTHENTICATED' } });
    fetchMock
      .mockResolvedValueOnce(unauth())
      .mockResolvedValueOnce(jsonResponse(200, envelope({ csrfToken: 'signed.csrf' })))
      .mockResolvedValueOnce(jsonResponse(200, envelope({ identity: {}, csrfToken: 'signed.csrf' })))
      .mockResolvedValueOnce(unauth());

    await expect(api.get('/threads')).rejects.toMatchObject({ status: 401, code: 'UNAUTHENTICATED' });
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('fetches GET /auth/csrf BEFORE POST /auth/session on a refresh-cookie reload', async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse(401, { success: false, message: 'Unauthenticated', error: { code: 'UNAUTHENTICATED' } })
      )
      .mockResolvedValueOnce(jsonResponse(200, envelope({ csrfToken: 'signed.csrf' })))
      .mockResolvedValueOnce(jsonResponse(200, envelope({ identity: { kind: 'anonymous' } })))
      .mockResolvedValueOnce(jsonResponse(200, envelope({ threads: [] })));

    const result = await api.get('/threads');
    expect(result.data).toEqual({ threads: [] });
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(fetchMock.mock.calls[1][0]).toBe(`${API_BASE_URL}/auth/csrf`);
    expect(fetchMock.mock.calls[2][0]).toBe(`${API_BASE_URL}/auth/session`);
  });

  it('resolves null (never throws) when the session bootstrap itself fails', async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse(401, { success: false, message: 'Unauthenticated', error: { code: 'UNAUTHENTICATED' } })
      )
      .mockResolvedValueOnce(jsonResponse(200, envelope({ csrfToken: 'signed.csrf' })))
      .mockResolvedValueOnce(
        jsonResponse(500, { success: false, message: 'boom', error: { code: 'INTERNAL_ERROR' } })
      );

    await expect(api.get('/threads')).rejects.toMatchObject({ status: 401, code: 'UNAUTHENTICATED' });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('refreshes the CSRF token and retries once when a write is rejected with CSRF_INVALID', async () => {
    // Seed a stale in-memory token (the cross-origin case: no readable cookie).
    fetchMock.mockResolvedValueOnce(jsonResponse(200, envelope({ csrfToken: 'stale.token' })));
    await api.post('/auth/login', { email: 'a@b.c', password: 'x' });
    fetchMock.mockClear();

    fetchMock
      .mockResolvedValueOnce(
        jsonResponse(403, {
          success: false,
          message: 'CSRF token does not match the session cookie',
          error: { code: 'CSRF_INVALID' },
        })
      )
      .mockResolvedValueOnce(jsonResponse(200, envelope({ csrfToken: 'fresh.token' })))
      .mockResolvedValueOnce(jsonResponse(201, envelope({ id: 'thread-1' })));

    const result = await api.post('/threads', { title: 'hello there', body: 'a valid body' });

    expect(result.data).toEqual({ id: 'thread-1' });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[1][0]).toBe(`${API_BASE_URL}/auth/csrf`);
    expect(fetchMock.mock.calls[2][0]).toBe(`${API_BASE_URL}/threads`);
    expect(fetchMock.mock.calls[2][1].headers['x-csrf-token']).toBe('fresh.token');
  });

  it('does not loop when the CSRF retry also fails', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, envelope({ csrfToken: 'stale.token' })));
    await api.post('/auth/login', { email: 'a@b.c', password: 'x' });
    fetchMock.mockClear();

    const csrfError = () =>
      jsonResponse(403, {
        success: false,
        message: 'rejected',
        error: { code: 'CSRF_INVALID' },
      });
    fetchMock
      .mockResolvedValueOnce(csrfError())
      .mockResolvedValueOnce(jsonResponse(200, envelope({ csrfToken: 'fresh.token' })))
      .mockResolvedValueOnce(csrfError());

    await expect(api.post('/threads', { title: 'x', body: 'y' })).rejects.toMatchObject({
      status: 403,
      code: 'CSRF_INVALID',
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('does not retry auth endpoints themselves', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(401, { success: false, message: 'Wrong password', error: { code: 'UNAUTHENTICATED' } })
    );

    await expect(api.post('/auth/login', { email: 'a@b.c', password: 'x' })).rejects.toMatchObject({
      status: 401,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

/**
 * Contract §12.6: "retries GET once on network failure".
 * This is asserted even though it currently fails — the test suite must encode the
 * contract, not the current behaviour.
 */
describe('apiClient network resilience (contract §12.6)', () => {
  let fetchMock;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    clearCsrfTokenCache();
    document.cookie = 'ay_csrf=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('retries a failed GET once before surfacing a network error', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValueOnce(
      jsonResponse(200, envelope({ boards: [] }))
    );

    await expect(api.get('/boards')).resolves.toMatchObject({ data: { boards: [] } });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not retry a failed mutating request (avoids duplicate writes)', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));

    await expect(api.post('/threads', { title: 'x', body: 'y' })).rejects.toMatchObject({
      code: 'NETWORK_ERROR',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
