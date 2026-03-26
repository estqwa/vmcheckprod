'use client';

import {
    createContext,
    useContext,
    useState,
    useEffect,
    useCallback,
    useRef,
    useMemo,
    ReactNode,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from './AuthProvider';
import { useRouter, usePathname } from 'next/navigation';
import { toast } from 'sonner';
import { userQueryKey, leaderboardQueryKey } from '@/lib/hooks/useUserQuery';
import { refreshTokens as refreshSessionTokens } from '@/lib/api/auth';

// ============================================================================
// Types
// ============================================================================

export interface WSMessage {
    type: string;
    data: Record<string, unknown>;
}

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

export type QuizPage = 'lobby' | 'play' | 'results' | null;

interface PendingAnswer {
    questionId: number;
    selectedOption: number;
    timestamp: number;
}

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
    return 'wss://qazaquiz.online';
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
    const pendingAnswerRef = useRef<PendingAnswer | null>(null);
    const pendingAnswerInFlightRef = useRef(false);
    const pendingAnswerToastShownRef = useRef(false);

    // State
    const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
    const [quizId, setQuizId] = useState<number | null>(null);

    // Derived state from pathname (computed, not stored)
    const currentPage = useMemo((): QuizPage => {
        if (!pathname) return null;
        const match = pathname.match(/\/quiz\/\d+\/(lobby|play|results)/);
        if (match) return match[1] as QuizPage;
        return null;
    }, [pathname]);

    // Derived state
    const isConnected = connectionState === 'connected';

    // ========================================================================
    // Helpers
    // ========================================================================

    const isConnectingRef = useRef(false);

    // Ref для doConnect функции (для использования в onclose до объявления)
    const doConnectRef = useRef<((quizId: number, isReconnect: boolean) => Promise<void>) | null>(null);

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

    const getLoginPath = useCallback(() => {
        if (!pathname) return '/login';

        const [, locale] = pathname.split('/');
        return locale ? `/${locale}/login` : '/login';
    }, [pathname]);

    const clearPendingAnswer = useCallback(() => {
        pendingAnswerRef.current = null;
        pendingAnswerInFlightRef.current = false;
        pendingAnswerToastShownRef.current = false;
    }, []);

    const flushPendingAnswer = useCallback((socket?: WebSocket) => {
        const pendingAnswer = pendingAnswerRef.current;
        const targetSocket = socket ?? wsRef.current;

        if (!pendingAnswer || pendingAnswerInFlightRef.current || targetSocket?.readyState !== WebSocket.OPEN) {
            return false;
        }

        targetSocket.send(JSON.stringify({
            type: 'user:answer',
            data: {
                question_id: pendingAnswer.questionId,
                selected_option: pendingAnswer.selectedOption,
                timestamp: pendingAnswer.timestamp,
            },
        }));
        pendingAnswerInFlightRef.current = true;

        return true;
    }, []);

    const requestResync = useCallback((socket?: WebSocket) => {
        const targetSocket = socket ?? wsRef.current;
        if (targetSocket?.readyState !== WebSocket.OPEN || currentQuizIdRef.current === null) {
            return;
        }

        targetSocket.send(JSON.stringify({
            type: 'user:resync',
            data: { quiz_id: currentQuizIdRef.current },
        }));
    }, []);

    const handleSessionEnded = useCallback(async (message: string) => {
        toast.error(message);
        await logout();
        router.push(getLoginPath());
    }, [getLoginPath, logout, router]);

    // ========================================================================
    // Core WebSocket Logic
    // ========================================================================

    const doConnect = useCallback(async (targetQuizId: number, isReconnect: boolean = false) => {
        // Prevent multiple simultaneous connections
        if (isConnectingRef.current) {
            console.log('[QuizWS] Connection already in progress, skipping...');
            return;
        }

        // Set target quiz ID immediately to prevent race conditions from layout useEffect
        const previousQuizId = currentQuizIdRef.current;
        currentQuizIdRef.current = targetQuizId;

        if (wsRef.current?.readyState === WebSocket.OPEN ||
            wsRef.current?.readyState === WebSocket.CONNECTING) {
            if (previousQuizId === targetQuizId) {
                console.log('[QuizWS] Already connected to this quiz');
                return;
            }
            // Different quiz - close old connection first
            wsRef.current.close();
        }

        isConnectingRef.current = true;
        setConnectionState(isReconnect ? 'reconnecting' : 'connecting');
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

                if (isReconnect) {
                    flushPendingAnswer(ws);
                    requestResync(ws);
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
                            void refreshSessionTokens().catch(() => {
                                // Ignore background refresh errors here.
                            });
                            return;

                        case 'TOKEN_EXPIRED':
                            void (async () => {
                                try {
                                    await refreshSessionTokens();

                                    if (wsRef.current?.readyState === WebSocket.OPEN || wsRef.current?.readyState === WebSocket.CONNECTING) {
                                        wsRef.current?.close(4001, 'token refreshed');
                                    } else if (currentQuizIdRef.current !== null) {
                                        void doConnectRef.current?.(currentQuizIdRef.current, true);
                                    }
                                } catch {
                                    await handleSessionEnded('Session expired. Please login again.');
                                }
                            })();
                            return;

                        case 'session_revoked':
                        case 'logout_all_devices':
                            void handleSessionEnded('Your session was ended.');
                            return;

                        case 'server:heartbeat':
                            // Heartbeat acknowledged
                            return;

                        case 'quiz:answer_result': {
                            const answeredQuestionId = typeof msg.data.question_id === 'number'
                                ? msg.data.question_id
                                : Number(msg.data.question_id);

                            if (pendingAnswerRef.current?.questionId === answeredQuestionId) {
                                clearPendingAnswer();
                            }

                            notifyHandlers(msg);
                            return;
                        }

                        case 'server:error': {
                            const errorCode = typeof msg.data.code === 'string' ? msg.data.code : '';
                            const errorMessage = typeof msg.data.message === 'string' ? msg.data.message : 'Server error';

                            if (errorCode === 'answer_error' && pendingAnswerRef.current) {
                                if (
                                    errorMessage.includes('already answered') ||
                                    errorMessage.includes('received answer for non-current question') ||
                                    errorMessage.includes('active quiz state not found') ||
                                    errorMessage.includes('user is eliminated')
                                ) {
                                    clearPendingAnswer();
                                }

                                if (errorMessage.includes('already answered')) {
                                    console.warn('[QuizWS] Pending answer was already accepted earlier');
                                    return;
                                }
                            }

                            console.error('[QuizWS] Server error:', msg.data);
                            toast.error(errorMessage);
                            break;
                        }

                        case 'quiz:finish':
                        case 'quiz:results_available':
                            clearPendingAnswer();
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
                if (pendingAnswerRef.current) {
                    pendingAnswerInFlightRef.current = false;
                }
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
                            // Используем ref для вызова актуальной версии doConnect
                            doConnectRef.current?.(currentQuizIdRef.current, true);
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
            const authError = error as { status?: number; error_type?: string };
            if (
                authError?.status === 401 &&
                ['token_missing', 'token_invalid', 'unauthorized'].includes(authError.error_type ?? '')
            ) {
                void handleSessionEnded('Session expired. Please login again.');
                return;
            }

            toast.error('Failed to connect to game server');
        }
    }, [
        clearPendingAnswer,
        clearTimers,
        flushPendingAnswer,
        getWsTicket,
        handleSessionEnded,
        notifyHandlers,
        queryClient,
        requestResync,
    ]);

    // Обновляем ref при каждом изменении doConnect
    useEffect(() => {
        doConnectRef.current = doConnect;
    }, [doConnect]);

    // ========================================================================
    // Public API
    // ========================================================================

    const connect = useCallback(async (newQuizId: number) => {
        await doConnect(newQuizId, false);
    }, [doConnect]);

    const disconnect = useCallback(() => {
        isIntentionalDisconnectRef.current = true;
        clearTimers();
        clearPendingAnswer();
        reconnectAttemptsRef.current = MAX_RECONNECT_ATTEMPTS; // Prevent auto-reconnect

        if (wsRef.current) {
            wsRef.current.close(1000, 'User disconnected');
            wsRef.current = null;
        }

        currentQuizIdRef.current = null;
        setQuizId(null);
        setConnectionState('disconnected');
    }, [clearPendingAnswer, clearTimers]);

    const send = useCallback((type: string, data: Record<string, unknown> = {}) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type, data }));
        } else {
            console.warn('[QuizWS] Cannot send - not connected');
        }
    }, []);

    const sendAnswer = useCallback((questionId: number, selectedOption: number) => {
        const timestamp = Date.now();

        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
                type: 'user:answer',
                data: {
                    question_id: questionId,
                    selected_option: selectedOption,
                    timestamp,
                },
            }));
            return;
        }

        pendingAnswerRef.current = {
            questionId,
            selectedOption,
            timestamp,
        };
        pendingAnswerInFlightRef.current = false;

        if (!pendingAnswerToastShownRef.current) {
            pendingAnswerToastShownRef.current = true;
            toast.info('Connection is recovering. Your answer will be sent automatically.');
        }

        if (currentQuizIdRef.current !== null && !isConnectingRef.current) {
            void doConnectRef.current?.(currentQuizIdRef.current, true);
        }
    }, []);

    const subscribe = useCallback((handler: (msg: WSMessage) => void) => {
        messageHandlersRef.current.add(handler);
        return () => {
            messageHandlersRef.current.delete(handler);
        };
    }, []);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        const resumeRealtime = () => {
            if (currentQuizIdRef.current === null || isIntentionalDisconnectRef.current) {
                return;
            }

            if (wsRef.current?.readyState === WebSocket.OPEN) {
                flushPendingAnswer();
                requestResync();
                return;
            }

            if (!isConnectingRef.current) {
                void doConnectRef.current?.(currentQuizIdRef.current, true);
            }
        };

        const handleOnline = () => {
            resumeRealtime();
        };

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                resumeRealtime();
            }
        };

        window.addEventListener('online', handleOnline);
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            window.removeEventListener('online', handleOnline);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [flushPendingAnswer, requestResync]);

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
