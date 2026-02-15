import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import {
  WS_CLIENT_EVENTS,
  WS_SYSTEM_EVENTS,
  isWSMessage,
  type WSServerMessage,
} from '@trivia/shared';
import { getWsTicket } from '../api/auth';
import { refreshTokens } from '../services/tokenService';
import {
  WS_HEARTBEAT_INTERVAL,
  WS_INITIAL_RECONNECT_DELAY,
  WS_MAX_RECONNECT_ATTEMPTS,
  WS_MAX_RECONNECT_DELAY,
  WS_URL,
} from '../constants/config';

const WS_STALE_THRESHOLD_MS = WS_HEARTBEAT_INTERVAL * 3;
const WS_WATCHDOG_INTERVAL_MS = 5000;

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

interface UseQuizWSOptions {
  quizId: number;
  enabled?: boolean;
  onMessage?: (msg: WSServerMessage) => void;
}

function getReconnectDelay(attempt: number): number {
  const cappedAttempt = Math.max(1, Math.min(attempt, WS_MAX_RECONNECT_ATTEMPTS));
  return Math.min(WS_INITIAL_RECONNECT_DELAY * Math.pow(2, cappedAttempt - 1), WS_MAX_RECONNECT_DELAY);
}

export function useQuizWS({ quizId, enabled = true, onMessage }: UseQuizWSOptions) {
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');

  const wsRef = useRef<WebSocket | null>(null);
  const connectRef = useRef<((isReconnect?: boolean) => Promise<void>) | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heartbeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const watchdogIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isIntentionalRef = useRef(false);
  const isConnectingRef = useRef(false);
  const allowReconnectRef = useRef(enabled);
  const enabledRef = useRef(enabled);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const isBackgroundRef = useRef(appStateRef.current !== 'active');
  const lastServerMessageAtRef = useRef(Date.now());
  const onMessageRef = useRef(onMessage);

  onMessageRef.current = onMessage;

  const isConnected = connectionState === 'connected';

  const clearReconnectTimer = useCallback(() => {
    if (!reconnectTimeoutRef.current) return;
    clearTimeout(reconnectTimeoutRef.current);
    reconnectTimeoutRef.current = null;
  }, []);

  const clearIntervals = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
    if (watchdogIntervalRef.current) {
      clearInterval(watchdogIntervalRef.current);
      watchdogIntervalRef.current = null;
    }
  }, []);

  const clearTimers = useCallback(() => {
    clearReconnectTimer();
    clearIntervals();
  }, [clearReconnectTimer, clearIntervals]);

  const scheduleReconnect = useCallback(
    (reason: string) => {
      if (!allowReconnectRef.current || !enabledRef.current || isBackgroundRef.current) return;

      clearReconnectTimer();
      reconnectAttemptsRef.current += 1;

      const delay = getReconnectDelay(reconnectAttemptsRef.current);
      setConnectionState('reconnecting');

      reconnectTimeoutRef.current = setTimeout(() => {
        console.log('[QuizWS] Reconnecting:', reason);
        void connectRef.current?.(true);
      }, delay);
    },
    [clearReconnectTimer]
  );

  const forceReconnect = useCallback(
    (reason: string) => {
      clearIntervals();

      if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
        const socket = wsRef.current;
        wsRef.current = null;
        isIntentionalRef.current = false;
        socket.close(4001, reason);
        return;
      }

      scheduleReconnect(reason);
    },
    [clearIntervals, scheduleReconnect]
  );

  const handleSystemEvent = useCallback(
    async (msg: WSServerMessage) => {
      if (msg.type === WS_SYSTEM_EVENTS.TOKEN_EXPIRE_SOON) {
        void refreshTokens();
        return;
      }

      if (msg.type === WS_SYSTEM_EVENTS.TOKEN_EXPIRED) {
        const refreshed = await refreshTokens();
        if (refreshed) {
          forceReconnect('token refreshed');
          return;
        }
      }

      if (
        msg.type === WS_SYSTEM_EVENTS.TOKEN_EXPIRED ||
        msg.type === WS_SYSTEM_EVENTS.SESSION_REVOKED ||
        msg.type === WS_SYSTEM_EVENTS.LOGOUT_ALL
      ) {
        allowReconnectRef.current = false;
        isIntentionalRef.current = true;
        clearTimers();
        if (wsRef.current) {
          wsRef.current.close(4001, 'session ended');
          wsRef.current = null;
        }
        setConnectionState('disconnected');
      }
    },
    [clearTimers, forceReconnect]
  );

  const connect = useCallback(
    async (isReconnect = false) => {
      if (!enabledRef.current || !allowReconnectRef.current || isBackgroundRef.current) return;
      if (isConnectingRef.current) return;
      if (wsRef.current?.readyState === WebSocket.OPEN || wsRef.current?.readyState === WebSocket.CONNECTING) return;

      isConnectingRef.current = true;
      setConnectionState(isReconnect ? 'reconnecting' : 'connecting');

      try {
        let ticket: string;

        try {
          ticket = await getWsTicket();
        } catch (ticketError: unknown) {
          const err = ticketError as { status?: number; error_type?: string };
          if (err?.status !== 401 && err?.error_type !== 'token_expired') {
            throw ticketError;
          }

          const refreshed = await refreshTokens();
          if (!refreshed) {
            allowReconnectRef.current = false;
            setConnectionState('disconnected');
            return;
          }

          ticket = await getWsTicket();
        }

        if (!enabledRef.current || !allowReconnectRef.current || isBackgroundRef.current) {
          setConnectionState('disconnected');
          return;
        }

        const ws = new WebSocket(`${WS_URL}/ws?ticket=${ticket}`);
        wsRef.current = ws;

        ws.onopen = () => {
          if (wsRef.current !== ws) return;

          setConnectionState('connected');
          reconnectAttemptsRef.current = 0;
          isIntentionalRef.current = false;
          lastServerMessageAtRef.current = Date.now();

          clearTimers();

          ws.send(
            JSON.stringify({
              type: WS_CLIENT_EVENTS.READY,
              data: { quiz_id: quizId },
            })
          );

          if (isReconnect) {
            ws.send(
              JSON.stringify({
                type: WS_CLIENT_EVENTS.RESYNC,
                data: { quiz_id: quizId },
              })
            );
          }

          heartbeatIntervalRef.current = setInterval(() => {
            if (ws.readyState !== WebSocket.OPEN) return;
            ws.send(
              JSON.stringify({
                type: WS_CLIENT_EVENTS.HEARTBEAT,
                data: {},
              })
            );
          }, WS_HEARTBEAT_INTERVAL);

          watchdogIntervalRef.current = setInterval(() => {
            if (ws.readyState !== WebSocket.OPEN) return;

            const idleForMs = Date.now() - lastServerMessageAtRef.current;
            if (idleForMs > WS_STALE_THRESHOLD_MS) {
              console.warn('[QuizWS] Stale connection detected, forcing reconnect');
              forceReconnect('stale connection');
            }
          }, WS_WATCHDOG_INTERVAL_MS);
        };

        ws.onmessage = (event) => {
          lastServerMessageAtRef.current = Date.now();

          try {
            if (typeof event.data !== 'string') {
              return;
            }

            const parsed: unknown = JSON.parse(event.data);
            if (!isWSMessage(parsed)) {
              console.warn('[QuizWS] Ignoring invalid message payload');
              return;
            }

            const msg = parsed as WSServerMessage;
            void handleSystemEvent(msg);

            try {
              onMessageRef.current?.(msg);
            } catch (handlerError) {
              console.error('[QuizWS] onMessage handler failed:', handlerError);
            }
          } catch (error) {
            console.error('[QuizWS] Parse error:', error);
          }
        };

        ws.onerror = (error) => {
          console.error('[QuizWS] Error:', error);
        };

        ws.onclose = (event) => {
          if (wsRef.current === ws) {
            wsRef.current = null;
          }

          clearIntervals();
          setConnectionState('disconnected');

          if (isIntentionalRef.current) {
            isIntentionalRef.current = false;
            return;
          }

          scheduleReconnect(`closed ${event.code}: ${event.reason || 'no reason'}`);
        };
      } catch (error) {
        console.error('[QuizWS] Connect failed:', error);
        setConnectionState('disconnected');
        scheduleReconnect('connect failed');
      } finally {
        isConnectingRef.current = false;
      }
    },
    [clearIntervals, clearTimers, forceReconnect, handleSystemEvent, quizId, scheduleReconnect]
  );

  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  const disconnect = useCallback(() => {
    allowReconnectRef.current = false;
    enabledRef.current = false;
    isIntentionalRef.current = true;
    reconnectAttemptsRef.current = 0;

    clearTimers();

    if (wsRef.current) {
      wsRef.current.close(1000, 'user disconnected');
      wsRef.current = null;
    }
    setConnectionState('disconnected');
  }, [clearTimers]);

  const send = useCallback((type: string, data: Record<string, unknown> = {}) => {
    if (wsRef.current?.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ type, data }));
  }, []);

  const sendAnswer = useCallback(
    (questionId: number, selectedOption: number) => {
      send(WS_CLIENT_EVENTS.ANSWER, {
        question_id: questionId,
        selected_option: selectedOption,
        timestamp: Date.now(),
      });
    },
    [send]
  );

  useEffect(() => {
    enabledRef.current = enabled;
    allowReconnectRef.current = enabled;

    clearTimers();
    if (wsRef.current) {
      isIntentionalRef.current = true;
      wsRef.current.close(1000, 'reset connection');
      wsRef.current = null;
    }

    if (enabled && !isBackgroundRef.current) {
      reconnectAttemptsRef.current = 0;
      void connect(false);
      return;
    }

    setConnectionState('disconnected');
  }, [enabled, quizId, connect, clearTimers]);

  useEffect(() => {
    const handleAppStateChange = (nextState: AppStateStatus) => {
      const wasBackground = appStateRef.current !== 'active';
      appStateRef.current = nextState;
      isBackgroundRef.current = nextState !== 'active';

      if (isBackgroundRef.current) {
        clearTimers();
        if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
          isIntentionalRef.current = true;
          wsRef.current.close(1000, 'app backgrounded');
          wsRef.current = null;
        }
        setConnectionState('disconnected');
        return;
      }

      if (wasBackground && allowReconnectRef.current && enabledRef.current) {
        reconnectAttemptsRef.current = 0;
        void connect(true);
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => {
      subscription.remove();
    };
  }, [clearTimers, connect]);

  useEffect(() => {
    return () => {
      allowReconnectRef.current = false;
      enabledRef.current = false;
      isIntentionalRef.current = true;
      clearTimers();
      if (wsRef.current) {
        wsRef.current.close(1000, 'cleanup');
        wsRef.current = null;
      }
    };
  }, [clearTimers]);

  return {
    connectionState,
    isConnected,
    send,
    sendAnswer,
    disconnect,
    reconnect: () => {
      enabledRef.current = true;
      allowReconnectRef.current = true;
      reconnectAttemptsRef.current = 0;
      void connect(true);
    },
  };
}
