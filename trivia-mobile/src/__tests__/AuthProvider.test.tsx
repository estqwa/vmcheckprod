import React, { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import renderer, { act } from 'react-test-renderer';
import * as ExpoRouter from 'expo-router';
import { AuthProvider, useAuth } from '../providers/AuthProvider';
import {
  checkAuth,
  getWsTicket,
  login,
  logout,
  register,
  updateProfile,
} from '../api/auth';

jest.mock('../api/auth', () => ({
  login: jest.fn(),
  register: jest.fn(),
  logout: jest.fn(),
  checkAuth: jest.fn(),
  getWsTicket: jest.fn(),
  updateProfile: jest.fn(),
}));

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

describe('AuthProvider', () => {
  const router = {
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (ExpoRouter.useRouter as jest.Mock).mockReturnValue(router);
    (ExpoRouter.useSegments as jest.Mock).mockReturnValue(['(auth)']);
    (checkAuth as jest.Mock).mockResolvedValue(null);
    (login as jest.Mock).mockResolvedValue({
      id: 1,
      username: 'user1',
      email: 'user1@test.com',
    });
    (register as jest.Mock).mockResolvedValue({
      id: 2,
      username: 'user2',
      email: 'user2@test.com',
    });
    (logout as jest.Mock).mockResolvedValue(undefined);
    (getWsTicket as jest.Mock).mockResolvedValue('ticket-1');
    (updateProfile as jest.Mock).mockResolvedValue(undefined);
  });

  async function mountWithProbe(queryClient: QueryClient, onUpdate: (value: unknown) => void) {
    function Probe() {
      const auth = useAuth();
      useEffect(() => {
        onUpdate(auth);
      }, [auth]);
      return null;
    }

    let tree: ReturnType<typeof renderer.create> | undefined;
    await act(async () => {
      tree = renderer.create(
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <Probe />
          </AuthProvider>
        </QueryClientProvider>,
      );
    });
    return tree!;
  }

  it('bootstraps authenticated user and redirects from auth group to tabs', async () => {
    (checkAuth as jest.Mock).mockResolvedValue({
      id: 11,
      username: 'boot-user',
      email: 'boot@test.com',
    });
    (ExpoRouter.useSegments as jest.Mock).mockReturnValue(['(auth)']);

    const queryClient = new QueryClient();
    let latestAuth: any = null;
    const tree = await mountWithProbe(queryClient, (value) => {
      latestAuth = value;
    });

    await waitForCondition(() => expect(latestAuth?.isLoading).toBe(false));

    expect(latestAuth?.isAuthenticated).toBe(true);
    expect(latestAuth?.user?.id).toBe(11);
    expect(router.replace).toHaveBeenCalledWith('/(tabs)');

    await act(async () => {
      tree.unmount();
    });
  });

  it('redirects unauthenticated user to login when outside auth group', async () => {
    (checkAuth as jest.Mock).mockResolvedValue(null);
    (ExpoRouter.useSegments as jest.Mock).mockReturnValue(['(tabs)']);

    const queryClient = new QueryClient();
    let latestAuth: any = null;
    const tree = await mountWithProbe(queryClient, (value) => {
      latestAuth = value;
    });

    await waitForCondition(() => expect(latestAuth?.isLoading).toBe(false));

    expect(latestAuth?.isAuthenticated).toBe(false);
    expect(router.replace).toHaveBeenCalledWith('/(auth)/login');

    await act(async () => {
      tree.unmount();
    });
  });

  it('executes login flow and stores authenticated user', async () => {
    const queryClient = new QueryClient();
    let latestAuth: any = null;
    const tree = await mountWithProbe(queryClient, (value) => {
      latestAuth = value;
    });

    await waitForCondition(() => expect(latestAuth?.isLoading).toBe(false));

    await act(async () => {
      await latestAuth?.login('user1@test.com', 'password');
    });

    expect(login).toHaveBeenCalledWith({
      email: 'user1@test.com',
      password: 'password',
    });
    expect(latestAuth?.user?.username).toBe('user1');
    expect(latestAuth?.isAuthenticated).toBe(true);

    await act(async () => {
      tree.unmount();
    });
  });

  it('sets readable error when login fails', async () => {
    (login as jest.Mock).mockRejectedValue({ error: 'Invalid credentials' });

    const queryClient = new QueryClient();
    let latestAuth: any = null;
    const tree = await mountWithProbe(queryClient, (value) => {
      latestAuth = value;
    });

    await waitForCondition(() => expect(latestAuth?.isLoading).toBe(false));

    await act(async () => {
      await expect(latestAuth?.login('bad@test.com', 'bad')).rejects.toEqual({
        error: 'Invalid credentials',
      });
    });

    expect(latestAuth?.error).toBe('Invalid credentials');

    await act(async () => {
      tree.unmount();
    });
  });

  it('executes logout flow and clears react-query cache', async () => {
    (checkAuth as jest.Mock).mockResolvedValue({
      id: 99,
      username: 'active-user',
      email: 'active@test.com',
    });
    (ExpoRouter.useSegments as jest.Mock).mockReturnValue(['(tabs)']);

    const queryClient = new QueryClient();
    const clearSpy = jest.spyOn(queryClient, 'clear');

    let latestAuth: any = null;
    const tree = await mountWithProbe(queryClient, (value) => {
      latestAuth = value;
    });

    await waitForCondition(() => expect(latestAuth?.isLoading).toBe(false));

    await act(async () => {
      await latestAuth?.logout();
    });

    expect(logout).toHaveBeenCalledTimes(1);
    expect(clearSpy).toHaveBeenCalledTimes(1);
    expect(latestAuth?.user).toBeNull();
    expect(latestAuth?.isAuthenticated).toBe(false);

    await act(async () => {
      tree.unmount();
    });
  });
});
