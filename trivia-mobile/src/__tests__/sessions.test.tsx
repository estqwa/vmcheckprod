import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Alert } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { waitFor } from '@testing-library/react-native';
import * as ExpoRouter from 'expo-router';
import SessionsScreen from '../../app/profile/sessions';
import { useAuth } from '../providers/AuthProvider';
import { getDeviceId } from '../services/tokenService';

jest.mock('../providers/AuthProvider', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../services/tokenService', () => ({
  getDeviceId: jest.fn(),
}));

describe('SessionsScreen', () => {
  const router = {
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (ExpoRouter.useRouter as jest.Mock).mockReturnValue(router);
    (getDeviceId as jest.Mock).mockResolvedValue('device-current');
  });

  it('shows Alert when revoke session fails', async () => {
    const revokeSession = jest.fn().mockRejectedValue({ error: 'Network fail' });
    (useAuth as jest.Mock).mockReturnValue({
      getActiveSessions: jest.fn().mockResolvedValue([
        {
          id: 11,
          device_id: 'device-other',
          ip_address: '127.0.0.1',
          user_agent: 'jest-agent',
          created_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 60_000).toISOString(),
        },
      ]),
      revokeSession,
      logoutAllDevices: jest.fn().mockResolvedValue(undefined),
      logout: jest.fn().mockResolvedValue(undefined),
    });

    const queryClient = new QueryClient();
    let tree: ReturnType<typeof renderer.create> | undefined;
    await act(async () => {
      tree = renderer.create(
        <QueryClientProvider client={queryClient}>
          <SessionsScreen />
        </QueryClientProvider>
      );
    });
    const mountedTree = tree!;
    const root = mountedTree.root;

    await waitFor(() =>
      expect(
        root.findAll(
          (node: any) =>
            typeof node.props?.onPress === 'function' &&
            node.props?.accessibilityLabel === 'profile.revokeSession'
        ).length
      ).toBeGreaterThan(0)
    , { timeout: 1500 });

    const revokeButton = root.findAll(
      (node: any) =>
        typeof node.props?.onPress === 'function' &&
        node.props?.accessibilityLabel === 'profile.revokeSession'
    )[0];

    await act(async () => {
      await revokeButton.props.onPress();
    });

    await waitFor(() =>
      expect((Alert.alert as jest.Mock)).toHaveBeenCalledWith('common.error', 'Network fail')
    , { timeout: 1500 });
    expect(revokeSession).toHaveBeenCalledWith(11);

    await act(async () => {
      mountedTree.unmount();
    });
  });

  it('shows Alert when logout all devices fails', async () => {
    const logoutAllDevices = jest.fn().mockRejectedValue({ error: 'Logout all failed' });
    (useAuth as jest.Mock).mockReturnValue({
      getActiveSessions: jest.fn().mockResolvedValue([
        {
          id: 21,
          device_id: 'device-other',
          ip_address: '127.0.0.1',
          user_agent: 'jest-agent',
          created_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 60_000).toISOString(),
        },
      ]),
      revokeSession: jest.fn().mockResolvedValue(undefined),
      logoutAllDevices,
      logout: jest.fn().mockResolvedValue(undefined),
    });

    const queryClient = new QueryClient();
    let tree: ReturnType<typeof renderer.create> | undefined;
    await act(async () => {
      tree = renderer.create(
        <QueryClientProvider client={queryClient}>
          <SessionsScreen />
        </QueryClientProvider>
      );
    });
    const mountedTree = tree!;
    const root = mountedTree.root;

    await waitFor(() =>
      expect(
        root.findAll(
          (node: any) =>
            typeof node.props?.onPress === 'function' &&
            node.props?.accessibilityLabel === 'profile.logoutAllDevices'
        ).length
      ).toBeGreaterThan(0)
    , { timeout: 1500 });

    const logoutAllButton = root.findAll(
      (node: any) =>
        typeof node.props?.onPress === 'function' &&
        node.props?.accessibilityLabel === 'profile.logoutAllDevices'
    )[0];

    await act(async () => {
      await logoutAllButton.props.onPress();
    });

    await waitFor(() =>
      expect((Alert.alert as jest.Mock)).toHaveBeenCalledWith('common.error', 'Logout all failed')
    , { timeout: 1500 });
    expect(logoutAllDevices).toHaveBeenCalledTimes(1);
    expect(router.replace).not.toHaveBeenCalledWith('/(auth)/login');

    await act(async () => {
      mountedTree.unmount();
    });
  });
});
