'use client';

import { useRef, useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/providers/AuthProvider';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'wss://triviabackend-jp8r.onrender.com';

interface WSMessage {
    type: string;
    data: Record<string, unknown>;
}

interface UseQuizWSOptions {
    quizId: number;
    onMessage: (msg: WSMessage) => void;
    onConnect?: () => void;
    onDisconnect?: () => void;
    autoReady?: boolean;
}

const MAX_RECONNECT_ATTEMPTS = 5;
const HEARTBEAT_INTERVAL = 30000; // 30 seconds

export function useQuizWS({
    quizId,
    onMessage,
    onConnect,
    onDisconnect,
    autoReady = true,
}: UseQuizWSOptions) {
    const router = useRouter();
    const { getWsTicket, logout } = useAuth();

    const wsRef = useRef<WebSocket | null>(null);
    const reconnectAttemptsRef = useRef(0);
    const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);

    const [isConnected, setIsConnected] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);

    // Clear all timers
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

    // Send message
    const send = useCallback((type: string, data: Record<string, unknown> = {}) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type, data }));
        }
    }, []);

    // Send answer
    const sendAnswer = useCallback((questionId: number, selectedOption: number) => {
        send('user:answer', {
            question_id: questionId,
            selected_option: selectedOption,
            timestamp: Date.now(),
        });
    }, [send]);

    // Connect to WebSocket
    const connect = useCallback(async () => {
        if (isConnecting || wsRef.current?.readyState === WebSocket.OPEN) {
            return;
        }

        setIsConnecting(true);

        try {
            const ticket = await getWsTicket();
            const ws = new WebSocket(`${WS_URL}/ws?ticket=${ticket}`);

            ws.onopen = () => {
                console.log('[WS] Connected');
                setIsConnected(true);
                setIsConnecting(false);
                reconnectAttemptsRef.current = 0;

                // Send ready message
                if (autoReady) {
                    ws.send(JSON.stringify({
                        type: 'user:ready',
                        data: { quiz_id: quizId }
                    }));
                }

                // Start heartbeat
                heartbeatIntervalRef.current = setInterval(() => {
                    if (ws.readyState === WebSocket.OPEN) {
                        ws.send(JSON.stringify({ type: 'user:heartbeat', data: {} }));
                    }
                }, HEARTBEAT_INTERVAL);

                onConnect?.();
            };

            ws.onmessage = (event) => {
                try {
                    const msg: WSMessage = JSON.parse(event.data);

                    // Handle system events
                    switch (msg.type) {
                        case 'TOKEN_EXPIRE_SOON':
                            // Proactively refresh token
                            console.log('[WS] Token expiring soon, refreshing...');
                            // Token refresh happens automatically via HTTP interceptor
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
                            // Heartbeat acknowledged, connection is alive
                            break;

                        case 'server:error':
                            console.error('[WS] Server error:', msg.data);
                            toast.error((msg.data.message as string) || 'Server error');
                            break;

                        default:
                            // Pass to handler
                            onMessage(msg);
                    }
                } catch (e) {
                    console.error('[WS] Failed to parse message:', e);
                }
            };

            ws.onerror = (error) => {
                console.error('[WS] Error:', error);
                setIsConnecting(false);
            };

            ws.onclose = (event) => {
                console.log('[WS] Closed:', event.code, event.reason);
                setIsConnected(false);
                setIsConnecting(false);
                clearTimers();
                onDisconnect?.();

                // Reconnect with exponential backoff
                if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
                    const delay = 1000 * Math.pow(2, reconnectAttemptsRef.current);
                    console.log(`[WS] Reconnecting in ${delay}ms... (attempt ${reconnectAttemptsRef.current + 1})`);

                    reconnectTimeoutRef.current = setTimeout(() => {
                        reconnectAttemptsRef.current++;
                        connect();
                    }, delay);
                } else {
                    toast.error('Connection lost. Please refresh the page.');
                }
            };

            wsRef.current = ws;
        } catch (error) {
            console.error('[WS] Failed to connect:', error);
            setIsConnecting(false);
            toast.error('Failed to connect to game server');
        }
    }, [isConnecting, getWsTicket, quizId, autoReady, onConnect, onMessage, onDisconnect, clearTimers, logout, router]);

    // Disconnect
    const disconnect = useCallback(() => {
        clearTimers();
        reconnectAttemptsRef.current = MAX_RECONNECT_ATTEMPTS; // Prevent reconnect
        if (wsRef.current) {
            wsRef.current.close();
            wsRef.current = null;
        }
    }, [clearTimers]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            disconnect();
        };
    }, [disconnect]);

    return {
        isConnected,
        isConnecting,
        connect,
        disconnect,
        send,
        sendAnswer,
    };
}
