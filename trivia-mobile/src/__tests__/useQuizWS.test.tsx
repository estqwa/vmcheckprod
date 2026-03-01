import React, { useEffect } from 'react';
import renderer, { act } from 'react-test-renderer';
import { AppState } from 'react-native';
import { WS_CLIENT_EVENTS } from '@trivia/shared';
import { waitFor } from '@testing-library/react-native';
import { useQuizWS } from '../hooks/useQuizWS';
import { getWsTicket } from '../api/auth';
import { refreshTokens } from '../services/tokenService';
import { useNetworkStatus } from '../hooks/useNetworkStatus';

jest.mock('../api/auth', () => ({
  getWsTicket: jest.fn(),
}));

jest.mock('../services/tokenService', () => ({
  refreshTokens: jest.fn(),
}));

jest.mock('../hooks/useNetworkStatus', () => ({
  useNetworkStatus: jest.fn(),
}));

class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;
  static instances: MockWebSocket[] = [];

  url: string;
  readyState = MockWebSocket.CONNECTING;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: ((event: { code: number; reason: string }) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  send = jest.fn();

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  open() {
    this.readyState = MockWebSocket.OPEN;
    this.onopen?.();
  }

  emitMessage(payload: unknown) {
    this.onmessage?.({ data: JSON.stringify(payload) });
  }

  close(code = 1000, reason = '') {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.({ code, reason });
  }
}

function getSentPayloads(ws: MockWebSocket): Array<{ type: string; data: Record<string, unknown> }> {
  return ws.send.mock.calls.map((call) => JSON.parse(call[0] as string));
}

describe('useQuizWS', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    MockWebSocket.instances = [];
    (global as unknown as { WebSocket: typeof MockWebSocket }).WebSocket = MockWebSocket;

    jest.spyOn(AppState, 'addEventListener').mockReturnValue({ remove: jest.fn() } as never);

    (useNetworkStatus as jest.Mock).mockReturnValue({
      isOffline: false,
      isOnline: true,
      isConnected: true,
      isInternetReachable: true,
    });
    (getWsTicket as jest.Mock).mockResolvedValue('ticket-1');
    (refreshTokens as jest.Mock).mockResolvedValue(null);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function mountHook(
    params: Parameters<typeof useQuizWS>[0],
    onUpdate: (state: ReturnType<typeof useQuizWS>) => void,
  ) {
    function Probe() {
      const state = useQuizWS(params);
      useEffect(() => {
        onUpdate(state);
      }, [state]);
      return null;
    }

    let tree: ReturnType<typeof renderer.create> | undefined;
    act(() => {
      tree = renderer.create(<Probe />);
    });
    return tree!;
  }

  it('connects and sends READY + RESYNC on open', async () => {
    const onMessage = jest.fn();
    let hookState: ReturnType<typeof useQuizWS> | null = null;
    const tree = mountHook({ quizId: 7, onMessage }, (state) => {
      hookState = state;
    });

    await waitFor(() => expect(MockWebSocket.instances.length).toBe(1), { timeout: 1500 });
    const ws = MockWebSocket.instances[0];

    act(() => {
      ws.open();
    });

    await waitFor(() => expect(hookState?.isConnected).toBe(true), { timeout: 1500 });

    const sent = getSentPayloads(ws);
    expect(sent.find((m) => m.type === WS_CLIENT_EVENTS.READY)).toEqual({
      type: WS_CLIENT_EVENTS.READY,
      data: { quiz_id: 7 },
    });
    expect(sent.find((m) => m.type === WS_CLIENT_EVENTS.RESYNC)).toEqual({
      type: WS_CLIENT_EVENTS.RESYNC,
      data: { quiz_id: 7 },
    });

    act(() => {
      tree.unmount();
    });
  });

  it('sends answer payload through websocket', async () => {
    let hookState: ReturnType<typeof useQuizWS> | null = null;
    const tree = mountHook({ quizId: 9 }, (state) => {
      hookState = state;
    });

    await waitFor(() => expect(MockWebSocket.instances.length).toBe(1), { timeout: 1500 });
    const ws = MockWebSocket.instances[0];

    act(() => {
      ws.open();
    });

    await waitFor(() => expect(hookState?.isConnected).toBe(true), { timeout: 1500 });

    act(() => {
      hookState?.sendAnswer(101, 2);
    });

    const sent = getSentPayloads(ws);
    const answerMessage = sent.find((m) => m.type === WS_CLIENT_EVENTS.ANSWER);
    expect(answerMessage?.data.question_id).toBe(101);
    expect(answerMessage?.data.selected_option).toBe(2);

    act(() => {
      tree.unmount();
    });
  });

  it('forwards valid incoming messages to onMessage callback', async () => {
    const onMessage = jest.fn();
    const tree = mountHook({ quizId: 5, onMessage }, () => undefined);

    await waitFor(() => expect(MockWebSocket.instances.length).toBe(1), { timeout: 1500 });
    const ws = MockWebSocket.instances[0];

    act(() => {
      ws.open();
    });

    const payload = {
      type: 'quiz:timer',
      data: {
        question_id: 10,
        remaining_seconds: 12,
        server_timestamp: Date.now(),
      },
    };

    act(() => {
      ws.emitMessage(payload);
    });

    await waitFor(() => expect(onMessage).toHaveBeenCalled(), { timeout: 1500 });
    expect(onMessage).toHaveBeenLastCalledWith(payload);

    act(() => {
      tree.unmount();
    });
  });

  it('does not emit debug reconnect warnings when __DEV__ is false', async () => {
    const prevDev = (globalThis as unknown as { __DEV__: boolean }).__DEV__;
    (globalThis as unknown as { __DEV__: boolean }).__DEV__ = false;
    jest.useFakeTimers();

    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    (getWsTicket as jest.Mock).mockRejectedValue(new Error('ticket failed'));

    let tree: ReturnType<typeof renderer.create> | null = null;

    try {
      tree = mountHook({ quizId: 42 }, () => undefined);

      await act(async () => {
        for (let i = 0; i < 8; i += 1) {
          jest.runOnlyPendingTimers();
          await Promise.resolve();
        }
      });

      expect(
        warnSpy.mock.calls.some(
          (call) =>
            typeof call[0] === 'string' &&
            call[0].includes('[QuizWS] Max reconnect attempts reached')
        )
      ).toBe(false);
    } finally {
      if (tree) {
        act(() => {
          tree.unmount();
        });
      }
      warnSpy.mockRestore();
      errorSpy.mockRestore();
      jest.useRealTimers();
      (globalThis as unknown as { __DEV__: boolean }).__DEV__ = prevDev;
    }
  });
});
