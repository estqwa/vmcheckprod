'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/providers/AuthProvider';
import { getQuiz, Quiz } from '@/lib/api';
import { useQuizWebSocket, WSMessage } from '@/providers/QuizWebSocketProvider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

export default function QuizLobbyPage() {
    const params = useParams();
    const router = useRouter();
    const quizId = Number(params.id);
    const { user } = useAuth();
    const { isConnected, connectionState, subscribe } = useQuizWebSocket();

    const [quiz, setQuiz] = useState<Quiz | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [timeRemaining, setTimeRemaining] = useState<string>('');

    const timerRef = useRef<NodeJS.Timeout | null>(null);

    // Fetch quiz info
    useEffect(() => {
        const fetchQuiz = async () => {
            try {
                const data = await getQuiz(quizId);
                setQuiz(data);
            } catch (error) {
                console.error('Failed to fetch quiz:', error);
                toast.error('Quiz not found');
                router.push('/');
            } finally {
                setIsLoading(false);
            }
        };

        fetchQuiz();
    }, [quizId, router]);

    // Countdown timer
    useEffect(() => {
        if (!quiz?.scheduled_time) return;

        const updateTimer = () => {
            const now = Date.now();
            const target = new Date(quiz.scheduled_time).getTime();
            const diff = target - now;

            if (diff <= 0) {
                setTimeRemaining('Starting...');
                return;
            }

            const hours = Math.floor(diff / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((diff % (1000 * 60)) / 1000);

            setTimeRemaining(
                `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
            );
        };

        updateTimer();
        timerRef.current = setInterval(updateTimer, 1000);

        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [quiz?.scheduled_time]);

    // Handle WebSocket messages
    const handleMessage = useCallback((msg: WSMessage) => {
        console.log('[Lobby] WS message:', msg.type);

        switch (msg.type) {
            case 'quiz:start':
                toast.success('Quiz is starting!');
                // Navigate to play page - WS stays connected via layout!
                router.push(`/quiz/${quizId}/play`);
                break;
            case 'quiz:countdown':
                // Could show countdown overlay
                break;
            case 'quiz:user_ready':
                // Another user joined
                break;
        }
    }, [quizId, router]);

    // Subscribe to messages
    useEffect(() => {
        const unsubscribe = subscribe(handleMessage);
        return () => unsubscribe();
    }, [subscribe, handleMessage]);

    if (isLoading) {
        return (
            <main className="container max-w-md mx-auto px-4 py-12">
                <Skeleton className="h-64 w-full" />
            </main>
        );
    }

    if (!quiz) {
        return null;
    }

    const getConnectionStatus = () => {
        switch (connectionState) {
            case 'connected': return { icon: '🟢', text: 'Connected' };
            case 'connecting': return { icon: '🟡', text: 'Connecting...' };
            case 'reconnecting': return { icon: '🟠', text: 'Reconnecting...' };
            default: return { icon: '🔴', text: 'Disconnected' };
        }
    };

    const connectionStatus = getConnectionStatus();

    return (
        <main className="container max-w-md mx-auto px-4 py-12">
            <Card>
                <CardHeader className="text-center">
                    <Badge className="w-fit mx-auto mb-2" variant="secondary">
                        {connectionStatus.icon} {connectionStatus.text}
                    </Badge>
                    <CardTitle>{quiz.title}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6 text-center">
                    {quiz.description && (
                        <p className="text-muted-foreground">{quiz.description}</p>
                    )}

                    <div>
                        <p className="text-muted-foreground mb-2">Game starts in:</p>
                        <p className="text-5xl font-mono font-bold text-primary">
                            {timeRemaining || '--:--:--'}
                        </p>
                    </div>

                    <div className="flex justify-center gap-8">
                        <div>
                            <p className="text-2xl font-bold">{quiz.question_count}</p>
                            <p className="text-muted-foreground text-sm">Questions</p>
                        </div>
                    </div>

                    {isConnected && (
                        <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                            <p className="text-green-500 font-medium">✓ You&apos;re ready!</p>
                            <p className="text-sm text-muted-foreground">
                                Waiting for the game to start...
                            </p>
                        </div>
                    )}

                    {!isConnected && connectionState === 'disconnected' && (
                        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                            <p className="text-red-500 font-medium">Connection lost</p>
                            <p className="text-sm text-muted-foreground">
                                Attempting to reconnect...
                            </p>
                        </div>
                    )}

                    <p className="text-xs text-muted-foreground">
                        Playing as <span className="font-medium">{user?.username}</span>
                    </p>
                </CardContent>
            </Card>

            <div className="text-center mt-8">
                <Button variant="ghost" onClick={() => router.push('/')}>
                    ← Leave Lobby
                </Button>
            </div>
        </main>
    );
}
