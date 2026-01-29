'use client';

import {
    createContext,
    useContext,
    useState,
    useEffect,
    useCallback,
    useRef,
    ReactNode,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from './AuthProvider';
import { useRouter, usePathname } from 'next/navigation';
import { toast } from 'sonner';
import { userQueryKey, leaderboardQueryKey } from '@/lib/hooks/useUserQuery';

// ============================================================================
// Types
// ============================================================================

export interface WSMessage {
    type: string;
    data: Record<string, unknown>;
}

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

export type QuizPage = 'lobby' | 'play' | 'results' | null;

interface QuizWebSocketContextType {
    // Connection state
    connectionState: ConnectionState;
    isConnected: boolean;

    // Current quiz
    quizId: number | null;
    currentPage: QuizPage;

    // Actions
    connect: (quizId: number) => Promise<void>;
    disconnect: () => void;
    send: (type: string, data?: Record<string, unknown>) => void;
    sendAnswer: (questionId: number, selectedOption: number) => void;

    // Message subscription
    subscribe: (handler: (msg: WSMessage) => void) => () => void;
}

const QuizWebSocketContext = createContext<QuizWebSocketContextType | null>(null);

// ============================================================================
// Constants
// ============================================================================

const getWSUrl = () => {
    if (process.env.NEXT_PUBLIC_WS_URL) return process.env.NEXT_PUBLIC_WS_URL;
    if (typeof window !== 'undefined') {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        return `${protocol}//${window.location.host}`;
    }
    return 'wss://qazaquiz.duckdns.org';
};

const WS_URL = getWSUrl();

// Reconnect settings
const MAX_RECONNECT_ATTEMPTS = 5;
const INITIAL_RECONNECT_DELAY = 1000;
const MAX_RECONNECT_DELAY = 30000;
const RECONNECT_GRACE_PERIOD = 2000; // Graceful delay before reconnect (server cleanup)

// Heartbeat settings
const HEARTBEAT_INTERVAL = 30000; // 30 seconds

// ============================================================================
// Provider Component
// ============================================================================

export function QuizWebSocketProvider({ children }: { children: ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const { getWsTicket, logout } = useAuth();
    const queryClient = useQueryClient();

    // Refs for WebSocket and timers
    const wsRef = useRef<WebSocket | null>(null);
    const reconnectAttemptsRef = useRef(0);
    const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const messageHandlersRef = useRef<Set<(msg: WSMessage) => void>>(new Set());
    const isIntentionalDisconnectRef = useRef(false);
    const currentQuizIdRef = useRef<number | null>(null);

    // State
    const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
    const [quizId, setQuizId] = useState<number | null>(null);
    const [currentPage, setCurrentPage] = useState<QuizPage>(null);

    // Derived state
    const isConnected = connectionState === 'connected';

    // ========================================================================
    // Helpers
    // ========================================================================

    const isConnectingRef = useRef(false);

    // ========================================================================
    // Helpers
    // ========================================================================

    const clearTimers = useCallback(() => {
        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = null;
        }
        if (heartbeatIntervalRef.current) {
            clearInterval(heartbeatIntervalRef.current);
            heartbeatIntervalRef.current = null;
        }
    }, []);

    const notifyHandlers = useCallback((msg: WSMessage) => {
        messageHandlersRef.current.forEach(handler => {
            try {
                handler(msg);
            } catch (e) {
                console.error('[QuizWS] Handler error:', e);
            }
        });
    }, []);

    // Detect current page from pathname
    useEffect(() => {
        if (!pathname) {
            setCurrentPage(null);
            return;
        }

        const match = pathname.match(/\/quiz\/(\d+)\/(lobby|play|results)/);
        if (match) {
            const page = match[2] as QuizPage;
            setCurrentPage(page);
        } else {
            setCurrentPage(null);
        }
    }, [pathname]);

    // ========================================================================
    // Core WebSocket Logic
    // ========================================================================

    const doConnect = useCallback(async (targetQuizId: number, isReconnect: boolean = false) => {
        // Prevent multiple simultaneous connections
        if (isConnectingRef.current) {
            console.log('[QuizWS] Connection already in progress, skipping...');
            return;
        }

        if (wsRef.current?.readyState === WebSocket.OPEN ||
            wsRef.current?.readyState === WebSocket.CONNECTING) {
            if (currentQuizIdRef.current === targetQuizId) {
                console.log('[QuizWS] Already connected to this quiz');
                return;
            }
            // Different quiz - close old connection first
            wsRef.current.close();
        }

        isConnectingRef.current = true;
        setConnectionState(isReconnect ? 'reconnecting' : 'connecting');
        currentQuizIdRef.current = targetQuizId;
        setQuizId(targetQuizId);

        try {
            const ticket = await getWsTicket();
            const ws = new WebSocket(`${WS_URL}/ws?ticket=${ticket}`);

            ws.onopen = () => {
                console.log('[QuizWS] Connected');
                isConnectingRef.current = false; // Connection successful
                setConnectionState('connected');
                reconnectAttemptsRef.current = 0;
                isIntentionalDisconnectRef.current = false;

                // Send ready message with quiz_id
                ws.send(JSON.stringify({
                    type: 'user:ready',
                    data: { quiz_id: targetQuizId }
                }));

                // Request current state (resync) for reconnects
                if (isReconnect) {
                    ws.send(JSON.stringify({
                        type: 'user:resync',
                        data: { quiz_id: targetQuizId }
                    }));
                }

                // Start heartbeat
                heartbeatIntervalRef.current = setInterval(() => {
                    if (ws.readyState === WebSocket.OPEN) {
                        ws.send(JSON.stringify({ type: 'user:heartbeat', data: {} }));
                    }
                }, HEARTBEAT_INTERVAL);
            };

            ws.onmessage = (event) => {
                try {
                    const msg: WSMessage = JSON.parse(event.data);

                    // Handle system events internally
                    switch (msg.type) {
                        case 'TOKEN_EXPIRE_SOON':
                            console.log('[QuizWS] Token expiring soon');
                            break;

                        case 'TOKEN_EXPIRED':
                            toast.error('Session expired. Please login again.');
                            logout();
                            router.push('/login');
                            return;

                        case 'session_revoked':
                        case 'logout_all_devices':
                            toast.error('Your session was ended.');
                            logout();
                            router.push('/login');
                            return;

                        case 'server:heartbeat':
                            // Heartbeat acknowledged
                            break;

                        case 'server:error':
                            console.error('[QuizWS] Server error:', msg.data);
                            toast.error((msg.data.message as string) || 'Server error');
                            break;

                        case 'quiz:finish':
                        case 'quiz:results_available':
                            // Инвалидируем данные пользователя и лидерборда после викторины
                            // Это обновит games_played, wins_count, total_score, total_prize_won
                            console.log('[QuizWS] Quiz finished/results available - invalidating user and leaderboard cache');
                            queryClient.invalidateQueries({ queryKey: userQueryKey });
                            queryClient.invalidateQueries({ queryKey: leaderboardQueryKey });
                            // Также пробрасываем подписчикам для UI обновлений
                            notifyHandlers(msg);
                            break;

                        default:
                            // Pass all other messages to subscribers
                            notifyHandlers(msg);
                    }
                } catch (e) {
                    console.error('[QuizWS] Failed to parse message:', e);
                }
            };

            ws.onerror = (error) => {
                console.error('[QuizWS] Error:', error);
                // Don't reset isConnecting here, allow onclose to handle
            };

            ws.onclose = (event) => {
                console.log('[QuizWS] Closed:', event.code, event.reason);
                isConnectingRef.current = false; // Reset lock on close
                setConnectionState('disconnected');
                clearTimers();

                // Only reconnect if not intentional disconnect
                if (!isIntentionalDisconnectRef.current &&
                    reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS &&
                    currentQuizIdRef.current !== null) {

                    // Calculate delay with exponential backoff + grace period
                    const baseDelay = Math.min(
                        INITIAL_RECONNECT_DELAY * Math.pow(2, reconnectAttemptsRef.current),
                        MAX_RECONNECT_DELAY
                    );
                    // Add grace period on first reconnect to let server clean up
                    const delay = reconnectAttemptsRef.current === 0
                        ? baseDelay + RECONNECT_GRACE_PERIOD
                        : baseDelay;

                    console.log(`[QuizWS] Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current + 1})`);
                    setConnectionState('reconnecting');

                    reconnectTimeoutRef.current = setTimeout(() => {
                        reconnectAttemptsRef.current++;
                        if (currentQuizIdRef.current !== null) {
                            doConnect(currentQuizIdRef.current, true);
                        }
                    }, delay);
                } else if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
                    toast.error('Connection lost. Please refresh the page.');
                }
            };

            wsRef.current = ws;
        } catch (error) {
            console.error('[QuizWS] Failed to connect:', error);
            isConnectingRef.current = false; // Reset lock on error
            setConnectionState('disconnected');
            toast.error('Failed to connect to game server');
        }
    }, [getWsTicket, logout, router, clearTimers, notifyHandlers]);

    // ========================================================================
    // Public API
    // ========================================================================

    const connect = useCallback(async (newQuizId: number) => {
        await doConnect(newQuizId, false);
    }, [doConnect]);

    const disconnect = useCallback(() => {
        isIntentionalDisconnectRef.current = true;
        clearTimers();
        reconnectAttemptsRef.current = MAX_RECONNECT_ATTEMPTS; // Prevent auto-reconnect

        if (wsRef.current) {
            wsRef.current.close(1000, 'User disconnected');
            wsRef.current = null;
        }

        currentQuizIdRef.current = null;
        setQuizId(null);
        setConnectionState('disconnected');
    }, [clearTimers]);

    const send = useCallback((type: string, data: Record<string, unknown> = {}) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type, data }));
        } else {
            console.warn('[QuizWS] Cannot send - not connected');
        }
    }, []);

    const sendAnswer = useCallback((questionId: number, selectedOption: number) => {
        send('user:answer', {
            question_id: questionId,
            selected_option: selectedOption,
            timestamp: Date.now(),
        });
    }, [send]);

    const subscribe = useCallback((handler: (msg: WSMessage) => void) => {
        messageHandlersRef.current.add(handler);
        return () => {
            messageHandlersRef.current.delete(handler);
        };
    }, []);

    // ========================================================================
    // Cleanup
    // ========================================================================

    useEffect(() => {
        return () => {
            // Only disconnect if intentional (component unmount outside quiz flow)
            // Don't disconnect on route changes within quiz
            if (currentPage === null) {
                disconnect();
            }
        };
    }, [currentPage, disconnect]);

    // ========================================================================
    // Context Value
    // ========================================================================

    const value: QuizWebSocketContextType = {
        connectionState,
        isConnected,
        quizId,
        currentPage,
        connect,
        disconnect,
        send,
        sendAnswer,
        subscribe,
    };

    return (
        <QuizWebSocketContext.Provider value={value}>
            {children}
        </QuizWebSocketContext.Provider>
    );
}

// ============================================================================
// Hook
// ============================================================================

export function useQuizWebSocket() {
    const context = useContext(QuizWebSocketContext);
    if (!context) {
        throw new Error('useQuizWebSocket must be used within a QuizWebSocketProvider');
    }
    return context;
}
