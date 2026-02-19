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
import { useNetworkStatus } from './useNetworkStatus';
import {
  WS_HEARTBEAT_INTERVAL,
  WS_INITIAL_RECONNECT_DELAY,
  WS_MAX_RECONNECT_ATTEMPTS,
  WS_MAX_RECONNECT_DELAY,
  WS_URL,
} from '../constants/config';

const WS_STALE_THRESHOLD_MS = WS_HEARTBEAT_INTERVAL * 3;
const WS_WATCHDOG_INTERVAL_MS = 5000;

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'offline';
export type SessionEndReason = 'token_expired' | 'session_revoked' | 'logout_all_devices';

interface UseQuizWSOptions {
  quizId: number;
  enabled?: boolean;
  onMessage?: (msg: WSServerMessage) => void;
  onSessionEnded?: (reason: SessionEndReason) => void | Promise<void>;
}

function getReconnectDelay(attempt: number): number {
  const cappedAttempt = Math.max(1, Math.min(attempt, WS_MAX_RECONNECT_ATTEMPTS));
  return Math.min(WS_INITIAL_RECONNECT_DELAY * Math.pow(2, cappedAttempt - 1), WS_MAX_RECONNECT_DELAY);
}

export function useQuizWS({ quizId, enabled = true, onMessage, onSessionEnded }: UseQuizWSOptions) {
  const { isOffline } = useNetworkStatus();
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
  const isOfflineRef = useRef(isOffline);
  const lastServerMessageAtRef = useRef(Date.now());
  const onMessageRef = useRef(onMessage);
  const onSessionEndedRef = useRef(onSessionEnded);
  const hasHandledSessionEndRef = useRef(false);

  isOfflineRef.current = isOffline;
  onMessageRef.current = onMessage;
  onSessionEndedRef.current = onSessionEnded;

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
      if (!allowReconnectRef.current || !enabledRef.current || isBackgroundRef.current || isOfflineRef.current) return;

      clearReconnectTimer();
      const nextAttempt = reconnectAttemptsRef.current + 1;
      if (nextAttempt > WS_MAX_RECONNECT_ATTEMPTS) {
        console.warn('[QuizWS] Max reconnect attempts reached, stopping auto-reconnect');
        setConnectionState('disconnected');
        return;
      }
      reconnectAttemptsRef.current = nextAttempt;

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
        // Сбрасываем флаг: onclose должен вызвать scheduleReconnect,
        // а не считать закрытие намеренным (isIntentional).
        isIntentionalRef.current = false;
        socket.close(4001, reason);
        return;
      }

      scheduleReconnect(reason);
    },
    [clearIntervals, scheduleReconnect]
  );

  const handleSessionEnded = useCallback(
    async (reason: SessionEndReason) => {
      if (hasHandledSessionEndRef.current) return;
      hasHandledSessionEndRef.current = true;

      allowReconnectRef.current = false;
      isIntentionalRef.current = true;
      clearTimers();

      if (wsRef.current) {
        wsRef.current.close(4001, 'session ended');
        wsRef.current = null;
      }
      setConnectionState('disconnected');

      try {
        await onSessionEndedRef.current?.(reason);
      } catch (callbackError) {
        console.error('[QuizWS] onSessionEnded callback failed:', callbackError);
      }
    },
    [clearTimers]
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
        await handleSessionEnded('token_expired');
        return;
      }

      if (msg.type === WS_SYSTEM_EVENTS.SESSION_REVOKED) {
        await handleSessionEnded('session_revoked');
        return;
      }

      if (msg.type === WS_SYSTEM_EVENTS.LOGOUT_ALL) {
        await handleSessionEnded('logout_all_devices');
      }
    },
    [forceReconnect, handleSessionEnded]
  );

  const connect = useCallback(
    async (isReconnect = false) => {
      if (!enabledRef.current || !allowReconnectRef.current || isBackgroundRef.current || isOfflineRef.current) {
        setConnectionState(isOfflineRef.current ? 'offline' : 'disconnected');
        return;
      }
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
            await handleSessionEnded('token_expired');
            return;
          }

          ticket = await getWsTicket();
        }

        if (!enabledRef.current || !allowReconnectRef.current || isBackgroundRef.current || isOfflineRef.current) {
          setConnectionState(isOfflineRef.current ? 'offline' : 'disconnected');
          return;
        }

        const ws = new WebSocket(`${WS_URL}/ws?ticket=${ticket}`);
        wsRef.current = ws;

        ws.onopen = () => {
          if (wsRef.current !== ws) return;

          setConnectionState('connected');
          hasHandledSessionEndRef.current = false;
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

          ws.send(
            JSON.stringify({
              type: WS_CLIENT_EVENTS.RESYNC,
              data: { quiz_id: quizId },
            })
          );

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
    [clearIntervals, clearTimers, forceReconnect, handleSessionEnded, handleSystemEvent, quizId, scheduleReconnect]
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
    hasHandledSessionEndRef.current = false;

    clearTimers();
    if (wsRef.current) {
      isIntentionalRef.current = true;
      wsRef.current.close(1000, 'reset connection');
      wsRef.current = null;
    }

    if (enabled && !isBackgroundRef.current) {
      if (isOfflineRef.current) {
        setConnectionState('offline');
        return;
      }
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
        setConnectionState(isOfflineRef.current ? 'offline' : 'disconnected');
        return;
      }

      if (wasBackground && allowReconnectRef.current && enabledRef.current && !isOfflineRef.current) {
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
    if (isOffline) {
      clearTimers();
      if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
        isIntentionalRef.current = true;
        wsRef.current.close(1000, 'network offline');
        wsRef.current = null;
      }
      setConnectionState('offline');
      return;
    }

    if (!enabledRef.current || !allowReconnectRef.current || isBackgroundRef.current) {
      return;
    }

    if (wsRef.current?.readyState === WebSocket.OPEN || wsRef.current?.readyState === WebSocket.CONNECTING) {
      return;
    }

    reconnectAttemptsRef.current = 0;
    void connect(true);
  }, [isOffline, connect, clearTimers]);

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
    isOffline,
    send,
    sendAnswer,
    disconnect,
    reconnect: () => {
      if (isOfflineRef.current) {
        setConnectionState('offline');
        return;
      }
      enabledRef.current = true;
      allowReconnectRef.current = true;
      reconnectAttemptsRef.current = 0;
      void connect(true);
    },
  };
}
