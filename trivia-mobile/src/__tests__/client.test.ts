import NetInfo from '@react-native-community/netinfo';
import { request } from '../api/client';
import { getAccessToken, refreshTokens } from '../services/tokenService';

jest.mock('@react-native-community/netinfo');
jest.mock('../services/tokenService', () => ({
  getAccessToken: jest.fn(),
  refreshTokens: jest.fn(),
}));

function makeResponse({
  ok = true,
  status = 200,
  body = {},
  contentType = 'application/json',
}: {
  ok?: boolean;
  status?: number;
  body?: unknown;
  contentType?: string;
}) {
  return {
    ok,
    status,
    json: jest.fn().mockResolvedValue(body),
    text: jest.fn().mockResolvedValue(typeof body === 'string' ? body : JSON.stringify(body)),
    headers: {
      get: (name: string) => {
        if (name.toLowerCase() === 'content-type') return contentType;
        return null;
      },
    },
  } as unknown as Response;
}

describe('api client', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (NetInfo.fetch as jest.Mock).mockResolvedValue({ isConnected: true, isInternetReachable: true });
    (getAccessToken as jest.Mock).mockResolvedValue('access-token');
    (refreshTokens as jest.Mock).mockResolvedValue(null);
    global.fetch = jest.fn() as unknown as typeof fetch;
  });

  it('injects bearer token for authenticated requests', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      makeResponse({ ok: true, status: 200, body: { ok: true } }),
    );

    const result = await request<{ ok: boolean }>('GET', '/api/test');

    expect(result).toEqual({ ok: true });
    expect(global.fetch).toHaveBeenCalledTimes(1);

    const [, config] = (global.fetch as jest.Mock).mock.calls[0] as [string, RequestInit];
    expect(config.headers).toMatchObject({
      Authorization: 'Bearer access-token',
      'Content-Type': 'application/json',
    });
  });

  it('does not inject bearer token when skipAuth is true', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      makeResponse({ ok: true, status: 200, body: { ok: true } }),
    );

    await request<{ ok: boolean }>('POST', '/api/mobile/auth/login', { email: 'a@b.c' }, { skipAuth: true });

    const [, config] = (global.fetch as jest.Mock).mock.calls[0] as [string, RequestInit];
    expect(config.headers).not.toHaveProperty('Authorization');
  });

  it('throws offline error when network is unavailable', async () => {
    (NetInfo.fetch as jest.Mock).mockResolvedValue({ isConnected: false, isInternetReachable: false });

    await expect(request('GET', '/api/test')).rejects.toMatchObject({
      error_type: 'offline',
      status: 0,
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('retries request after token refresh on 401 token_expired', async () => {
    (refreshTokens as jest.Mock).mockResolvedValue({
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token',
    });

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(
        makeResponse({
          ok: false,
          status: 401,
          body: { error_type: 'token_expired', error: 'expired' },
        }),
      )
      .mockResolvedValueOnce(
        makeResponse({
          ok: true,
          status: 200,
          body: { success: true },
        }),
      );

    const result = await request<{ success: boolean }>('GET', '/api/protected');

    expect(result).toEqual({ success: true });
    expect(global.fetch).toHaveBeenCalledTimes(2);

    const [, retryConfig] = (global.fetch as jest.Mock).mock.calls[1] as [string, RequestInit];
    expect(retryConfig.headers).toMatchObject({
      Authorization: 'Bearer new-access-token',
    });
  });

  it('aborts timed out request', async () => {
    jest.useFakeTimers();

    (global.fetch as jest.Mock).mockImplementation((_url: string, init?: RequestInit) => {
      return new Promise((_, reject) => {
        init?.signal?.addEventListener('abort', () => {
          const abortError = new Error('aborted');
          (abortError as Error & { name: string }).name = 'AbortError';
          reject(abortError);
        });
      });
    });

    const pending = request('GET', '/api/slow-endpoint');
    const assertion = expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    await jest.advanceTimersByTimeAsync(15_100);

    await assertion;
    jest.useRealTimers();
  });
});
