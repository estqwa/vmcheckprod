const ACCESS_TOKEN_KEY = 'trivia_access_token';
const REFRESH_TOKEN_KEY = 'trivia_refresh_token';
const DEVICE_ID_KEY = 'trivia_device_id';

type TokenServiceModule = typeof import('../services/tokenService');

function makeResponse({
  ok,
  status,
  body,
}: {
  ok: boolean;
  status: number;
  body: unknown;
}) {
  return {
    ok,
    status,
    json: jest.fn().mockResolvedValue(body),
  } as unknown as Response;
}

async function waitForCondition(assertion: () => void, timeoutMs = 1500) {
  const started = Date.now();
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      assertion();
      return;
    } catch (error) {
      if (Date.now() - started > timeoutMs) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
  }
}

describe('tokenService', () => {
  let tokenService: TokenServiceModule;
  let store: Map<string, string>;
  let secureStore: typeof import('expo-secure-store');

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    store = new Map();
    secureStore = require('expo-secure-store');

    (secureStore.getItemAsync as jest.Mock).mockImplementation(async (key: string) => store.get(key) ?? null);
    (secureStore.setItemAsync as jest.Mock).mockImplementation(async (key: string, value: string) => {
      store.set(key, value);
    });
    (secureStore.deleteItemAsync as jest.Mock).mockImplementation(async (key: string) => {
      store.delete(key);
    });

    global.fetch = jest.fn() as unknown as typeof fetch;

    tokenService = require('../services/tokenService') as TokenServiceModule;
  });

  it('saves tokens and reads access token from in-memory cache', async () => {
    await tokenService.saveTokens({ accessToken: 'access-1', refreshToken: 'refresh-1' });
    const access = await tokenService.getAccessToken();

    expect(access).toBe('access-1');
    expect(store.get(ACCESS_TOKEN_KEY)).toBe('access-1');
    expect(store.get(REFRESH_TOKEN_KEY)).toBe('refresh-1');
    expect(secureStore.getItemAsync).not.toHaveBeenCalledWith(ACCESS_TOKEN_KEY);
  });

  it('clears saved tokens', async () => {
    await tokenService.saveTokens({ accessToken: 'access-1', refreshToken: 'refresh-1' });
    await tokenService.clearTokens();

    expect(await tokenService.getAccessToken()).toBeNull();
    expect(await tokenService.getRefreshToken()).toBeNull();
    expect(store.has(ACCESS_TOKEN_KEY)).toBe(false);
    expect(store.has(REFRESH_TOKEN_KEY)).toBe(false);
  });

  it('refreshes tokens and persists updated pair', async () => {
    store.set(REFRESH_TOKEN_KEY, 'refresh-old');
    store.set(DEVICE_ID_KEY, 'device-1');

    (global.fetch as jest.Mock).mockResolvedValue(
      makeResponse({
        ok: true,
        status: 200,
        body: { accessToken: 'access-new', refreshToken: 'refresh-new' },
      }),
    );

    const result = await tokenService.refreshTokens();

    expect(result).toEqual({ accessToken: 'access-new', refreshToken: 'refresh-new' });
    expect(store.get(ACCESS_TOKEN_KEY)).toBe('access-new');
    expect(store.get(REFRESH_TOKEN_KEY)).toBe('refresh-new');
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('deduplicates parallel refresh requests', async () => {
    store.set(REFRESH_TOKEN_KEY, 'refresh-old');
    store.set(DEVICE_ID_KEY, 'device-1');

    let resolveFetch!: (value: Response) => void;
    (global.fetch as jest.Mock).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveFetch = resolve;
        }),
    );

    const p1 = tokenService.refreshTokens();
    const p2 = tokenService.refreshTokens();

    await waitForCondition(() => expect(global.fetch).toHaveBeenCalledTimes(1));

    resolveFetch(
      makeResponse({
        ok: true,
        status: 200,
        body: { accessToken: 'access-new', refreshToken: 'refresh-new' },
      }),
    );

    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r1).toEqual({ accessToken: 'access-new', refreshToken: 'refresh-new' });
    expect(r2).toEqual({ accessToken: 'access-new', refreshToken: 'refresh-new' });
  });

  it('clears local tokens when refresh endpoint returns 401', async () => {
    store.set(ACCESS_TOKEN_KEY, 'access-old');
    store.set(REFRESH_TOKEN_KEY, 'refresh-old');
    store.set(DEVICE_ID_KEY, 'device-1');

    (global.fetch as jest.Mock).mockResolvedValue(
      makeResponse({
        ok: false,
        status: 401,
        body: { error: 'invalid refresh' },
      }),
    );

    const result = await tokenService.refreshTokens();

    expect(result).toBeNull();
    expect(store.has(ACCESS_TOKEN_KEY)).toBe(false);
    expect(store.has(REFRESH_TOKEN_KEY)).toBe(false);
  });
});
