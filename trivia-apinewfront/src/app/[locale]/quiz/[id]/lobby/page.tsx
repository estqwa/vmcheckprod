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
import { CountdownTile } from '@/components/ui/countdown-tile';
import { Skeleton } from '@/components/ui/skeleton';
import { StateBanner } from '@/components/ui/state-banner';
import { StatTile } from '@/components/ui/stat-tile';
import { toast } from 'sonner';
import { QuizFlowHeader } from '@/components/quiz/QuizFlowHeader';
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
                    <div className="container mx-auto flex h-16 max-w-6xl items-center px-4">
                        <Skeleton className="h-8 w-32" />
                    </div>
                </header>
                <main className="container mx-auto max-w-md px-4 py-8 sm:py-12">
                    <Skeleton className="h-96 w-full rounded-2xl" />
                </main>
            </div>
        );
    }

    if (!quiz) return null;

    const getConnectionStatus = () => {
        switch (connectionState) {
            case 'connected':
                return {
                    Icon: Wifi,
                    text: t('connected') || 'Connected',
                    description: t('waiting'),
                    badgeTone: 'success' as const,
                    bannerTone: 'success' as const,
                    iconClass: 'text-success',
                };
            case 'connecting':
                return {
                    Icon: Loader2,
                    text: t('connecting') || 'Connecting...',
                    description: t('reconnecting') || 'Trying to reconnect...',
                    badgeTone: 'info' as const,
                    bannerTone: 'info' as const,
                    iconClass: 'text-warning animate-spin',
                };
            case 'reconnecting':
                return {
                    Icon: Zap,
                    text: t('reconnecting') || 'Reconnecting...',
                    description: t('reconnecting') || 'Trying to reconnect...',
                    badgeTone: 'warning' as const,
                    bannerTone: 'warning' as const,
                    iconClass: 'text-orange-600',
                };
            default:
                return {
                    Icon: WifiOff,
                    text: t('disconnected') || 'Disconnected',
                    description: t('reconnecting') || 'Trying to reconnect...',
                    badgeTone: 'offline' as const,
                    bannerTone: 'offline' as const,
                    iconClass: 'text-red-600',
                };
        }
    };

    const status = getConnectionStatus();

    return (
        <div className="min-h-app">
            <QuizFlowHeader
                status={{
                    tone: status.badgeTone,
                    icon: <status.Icon className={`h-3.5 w-3.5 ${status.iconClass}`} />,
                    text: status.text,
                }}
            />

            <main className="container mx-auto max-w-md px-4 py-8 sm:py-12">
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
                                <CountdownTile value={String(timeRemaining.hours).padStart(2, '0')} label={t('hours') || 'Hours'} />
                                <CountdownTile value={String(timeRemaining.minutes).padStart(2, '0')} label={t('minutes') || 'Minutes'} />
                                <CountdownTile value={String(timeRemaining.seconds).padStart(2, '0')} label={t('seconds') || 'Seconds'} />
                            </div>
                        </div>

                        {/* Stats */}
                        <div className="grid gap-3 sm:grid-cols-2">
                            <StatTile
                                label={t('online') || 'Online'}
                                value={playerCount}
                                tone="success"
                                size="compact"
                                className="items-center text-center"
                            />
                            <StatTile
                                label={t('questions') || 'Questions'}
                                value={quiz.question_count}
                                size="compact"
                                className="items-center text-center"
                            />
                        </div>

                        {/* Status */}
                        <StateBanner
                            tone={status.bannerTone}
                            icon={
                                isConnected ? (
                                    <CheckCircle2 className="h-4 w-4" />
                                ) : (
                                    <status.Icon className={`h-4 w-4 ${status.iconClass}`} />
                                )
                            }
                            title={isConnected ? (t('ready') || 'Ready') : status.text}
                            description={status.description}
                        />

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

