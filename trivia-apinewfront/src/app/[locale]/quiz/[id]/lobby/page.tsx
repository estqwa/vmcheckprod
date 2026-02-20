'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/providers/AuthProvider';
import { getQuiz, Quiz } from '@/lib/api';
import { useQuizWebSocket, WSMessage } from '@/providers/QuizWebSocketProvider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { ArrowLeft, CheckCircle2, Gamepad2, Loader2, Wifi, WifiOff, Zap } from 'lucide-react';

export default function QuizLobbyPage() {
    const params = useParams();
    const router = useRouter();
    const quizId = Number(params.id);
    const { user } = useAuth();
    const { isConnected, connectionState, subscribe } = useQuizWebSocket();

    const t = useTranslations('quiz');

    const [quiz, setQuiz] = useState<Quiz | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [timeRemaining, setTimeRemaining] = useState<{ hours: number; minutes: number; seconds: number }>({
        hours: 0, minutes: 0, seconds: 0
    });
    const [playerCount, setPlayerCount] = useState<number>(0);

    const timerRef = useRef<NodeJS.Timeout | null>(null);

    // Fetch quiz info
    useEffect(() => {
        const fetchQuiz = async () => {
            try {
                const data = await getQuiz(quizId);
                setQuiz(data);
            } catch (error) {
                console.error('Failed to fetch quiz:', error);
                toast.error(t('notFound') || 'Quiz not found');
                router.push('/');
            } finally {
                setIsLoading(false);
            }
        };

        fetchQuiz();
    }, [quizId, router, t]);

    // Countdown timer
    useEffect(() => {
        if (!quiz?.scheduled_time) return;

        const updateTimer = () => {
            const now = Date.now();
            const target = new Date(quiz.scheduled_time).getTime();
            const diff = target - now;

            if (diff <= 0) {
                setTimeRemaining({ hours: 0, minutes: 0, seconds: 0 });
                return;
            }

            const hours = Math.floor(diff / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((diff % (1000 * 60)) / 1000);

            setTimeRemaining({ hours, minutes, seconds });
        };

        updateTimer();
        timerRef.current = setInterval(updateTimer, 1000);

        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [quiz?.scheduled_time]);

    // Handle WebSocket messages
    const handleMessage = useCallback((msg: WSMessage) => {
        console.log('[Lobby] WS message:', msg.type, msg.data);

        switch (msg.type) {
            case 'quiz:start':
                toast.success(t('starting') || 'Quiz is starting!');
                router.push(`/quiz/${quizId}/play`);
                break;
            case 'quiz:countdown':
                break;
            case 'quiz:user_ready':
                if (msg.data?.player_count !== undefined) {
                    setPlayerCount(msg.data.player_count as number);
                }
                break;
            case 'quiz:player_count':
                if (msg.data?.player_count !== undefined) {
                    setPlayerCount(msg.data.player_count as number);
                }
                break;
        }
    }, [quizId, router, t]);

    useEffect(() => {
        const unsubscribe = subscribe(handleMessage);
        return () => unsubscribe();
    }, [subscribe, handleMessage]);

    if (isLoading) {
        return (
            <div className="min-h-app">
                <header className="border-b border-border/50 bg-white/80 backdrop-blur-sm">
                    <div className="container max-w-6xl mx-auto px-4 h-16 flex items-center">
                        <Skeleton className="h-8 w-32" />
                    </div>
                </header>
                <main className="container max-w-md mx-auto px-4 py-12">
                    <Skeleton className="h-96 w-full rounded-2xl" />
                </main>
            </div>
        );
    }

    if (!quiz) return null;

    const getConnectionStatus = () => {
        switch (connectionState) {
            case 'connected':
                return { Icon: Wifi, text: t('connected') || 'Connected', color: 'text-green-600 bg-green-50', iconClass: 'text-green-600' };
            case 'connecting':
                return { Icon: Loader2, text: t('connecting') || 'Connecting...', color: 'text-yellow-600 bg-yellow-50', iconClass: 'text-yellow-600 animate-spin' };
            case 'reconnecting':
                return { Icon: Zap, text: t('reconnecting') || 'Reconnecting...', color: 'text-orange-600 bg-orange-50', iconClass: 'text-orange-600' };
            default:
                return { Icon: WifiOff, text: t('disconnected') || 'Disconnected', color: 'text-red-600 bg-red-50', iconClass: 'text-red-600' };
        }
    };

    const status = getConnectionStatus();

    return (
        <div className="min-h-app">
            {/* Header */}
            <header className="border-b border-border/50 bg-white/80 backdrop-blur-sm">
                <div className="container max-w-6xl mx-auto px-4 py-2 min-h-16 flex flex-wrap items-center justify-between gap-2">
                    <Link href="/" className="flex items-center gap-2 shrink-0">
                        <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
                            <span className="text-white font-bold text-lg">Q</span>
                        </div>
                        <span className="font-bold text-xl text-foreground">QazaQuiz</span>
                    </Link>
                    <div className="ml-auto sm:ml-0 flex items-center gap-2">
                        <LanguageSwitcher />
                        <Badge className={`${status.color} border-0`}>
                            <status.Icon className={`w-3.5 h-3.5 mr-1 ${status.iconClass}`} />
                            {status.text}
                        </Badge>
                    </div>
                </div>
            </header>

            <main className="container max-w-md mx-auto px-4 py-12">
                <Card className="card-elevated border-0 rounded-2xl overflow-hidden">
                    <CardHeader className="text-center bg-gradient-to-b from-primary/5 to-transparent pb-6">
                        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                            <Gamepad2 className="w-8 h-8 text-primary" />
                        </div>
                        <CardTitle className="text-2xl">{quiz.title}</CardTitle>
                        {quiz.description && (
                            <p className="text-muted-foreground mt-2">{quiz.description}</p>
                        )}
                    </CardHeader>

                    <CardContent className="space-y-6 text-center pt-0">
                        {/* Timer */}
                        <div>
                            <p className="text-sm text-muted-foreground mb-3">{t('startsIn') || 'Starts in'}</p>
                            <div className="flex justify-center gap-2">
                                <div className="timer-block">
                                    <div className="value">{String(timeRemaining.hours).padStart(2, '0')}</div>
                                    <div className="label">{t('hours') || 'Hours'}</div>
                                </div>
                                <div className="timer-block">
                                    <div className="value">{String(timeRemaining.minutes).padStart(2, '0')}</div>
                                    <div className="label">{t('minutes') || 'Minutes'}</div>
                                </div>
                                <div className="timer-block">
                                    <div className="value">{String(timeRemaining.seconds).padStart(2, '0')}</div>
                                    <div className="label">{t('seconds') || 'Seconds'}</div>
                                </div>
                            </div>
                        </div>

                        {/* Stats */}
                        <div className="flex justify-center gap-8">
                            <div>
                                <p className="text-2xl font-bold text-green-600">{playerCount}</p>
                                <p className="text-muted-foreground text-sm">{t('online') || 'Online'}</p>
                            </div>
                            <div>
                                <p className="text-2xl font-bold">{quiz.question_count}</p>
                                <p className="text-muted-foreground text-sm">{t('questions') || 'Questions'}</p>
                            </div>
                        </div>

                        {/* Status */}
                        {isConnected ? (
                            <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                                <p className="text-green-700 font-medium flex items-center justify-center gap-2">
                                    <CheckCircle2 className="w-4 h-4" />
                                    {t('ready') || 'Ready'}
                                </p>
                                <p className="text-sm text-green-600/80">
                                    {t('waiting')}
                                </p>
                            </div>
                        ) : connectionState === 'disconnected' ? (
                            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                                <p className="text-red-700 font-medium">{t('connectionLost') || 'Connection lost'}</p>
                                <p className="text-sm text-red-600/80">
                                    {t('reconnecting') || 'Trying to reconnect...'}
                                </p>
                            </div>
                        ) : (
                            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                                <p className="text-yellow-700 font-medium">{t('connecting') || 'Connecting...'}</p>
                            </div>
                        )}

                        <p className="text-sm text-muted-foreground">
                            {t('playingAs') || 'Playing as'} <span className="font-semibold text-foreground">{user?.username}</span>
                        </p>
                    </CardContent>
                </Card>

                <div className="text-center mt-8">
                    <Button asChild variant="ghost">
                        <Link href="/" className="inline-flex items-center gap-2">
                            <ArrowLeft className="w-4 h-4" />
                            {t('leaveLobby') || 'Leave lobby'}
                        </Link>
                    </Button>
                </div>
            </main>
        </div>
    );
}
