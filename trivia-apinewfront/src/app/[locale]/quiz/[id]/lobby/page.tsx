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

export default function QuizLobbyPage() {
    const params = useParams();
    const router = useRouter();
    const quizId = Number(params.id);
    const { user } = useAuth();
    const { isConnected, connectionState, subscribe } = useQuizWebSocket();

    const t = useTranslations('quiz');
    const tNav = useTranslations('nav');
    const tCommon = useTranslations('common');

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
                toast.error(t('notFound') || 'Викторина не найдена');
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
                toast.success(t('starting') || 'Викторина начинается!');
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
            <div className="min-h-screen">
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
            case 'connected': return { icon: '🟢', text: t('connected') || 'Подключён', color: 'text-green-600 bg-green-50' };
            case 'connecting': return { icon: '🟡', text: t('connecting') || 'Подключение...', color: 'text-yellow-600 bg-yellow-50' };
            case 'reconnecting': return { icon: '🟠', text: t('reconnecting') || 'Переподключение...', color: 'text-orange-600 bg-orange-50' };
            default: return { icon: '🔴', text: t('disconnected') || 'Отключён', color: 'text-red-600 bg-red-50' };
        }
    };

    const status = getConnectionStatus();

    return (
        <div className="min-h-screen">
            {/* Header */}
            <header className="border-b border-border/50 bg-white/80 backdrop-blur-sm">
                <div className="container max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
                    <Link href="/" className="flex items-center gap-2">
                        <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
                            <span className="text-white font-bold text-lg">Q</span>
                        </div>
                        <span className="font-bold text-xl text-foreground">QazaQuiz</span>
                    </Link>
                    <div className="flex items-center gap-2">
                        <LanguageSwitcher />
                        <Badge className={`${status.color} border-0`}>
                            {status.icon} {status.text}
                        </Badge>
                    </div>
                </div>
            </header>

            <main className="container max-w-md mx-auto px-4 py-12">
                <Card className="card-elevated border-0 rounded-2xl overflow-hidden">
                    <CardHeader className="text-center bg-gradient-to-b from-primary/5 to-transparent pb-6">
                        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                            <span className="text-3xl">🎮</span>
                        </div>
                        <CardTitle className="text-2xl">{quiz.title}</CardTitle>
                        {quiz.description && (
                            <p className="text-muted-foreground mt-2">{quiz.description}</p>
                        )}
                    </CardHeader>

                    <CardContent className="space-y-6 text-center pt-0">
                        {/* Timer */}
                        <div>
                            <p className="text-sm text-muted-foreground mb-3">{t('startsIn') || 'Игра начнётся через'}</p>
                            <div className="flex justify-center gap-2">
                                <div className="timer-block">
                                    <div className="value">{String(timeRemaining.hours).padStart(2, '0')}</div>
                                    <div className="label">{t('hours') || 'Часов'}</div>
                                </div>
                                <div className="timer-block">
                                    <div className="value">{String(timeRemaining.minutes).padStart(2, '0')}</div>
                                    <div className="label">{t('minutes') || 'Минут'}</div>
                                </div>
                                <div className="timer-block">
                                    <div className="value">{String(timeRemaining.seconds).padStart(2, '0')}</div>
                                    <div className="label">{t('seconds') || 'Секунд'}</div>
                                </div>
                            </div>
                        </div>

                        {/* Stats */}
                        <div className="flex justify-center gap-8">
                            <div>
                                <p className="text-2xl font-bold text-green-600">{playerCount}</p>
                                <p className="text-muted-foreground text-sm">{t('online') || 'Онлайн'}</p>
                            </div>
                            <div>
                                <p className="text-2xl font-bold">{quiz.question_count}</p>
                                <p className="text-muted-foreground text-sm">{t('questions') || 'Вопросов'}</p>
                            </div>
                        </div>

                        {/* Status */}
                        {isConnected ? (
                            <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                                <p className="text-green-700 font-medium">✓ {t('ready') || 'Вы готовы!'}</p>
                                <p className="text-sm text-green-600/80">
                                    {t('waiting')}
                                </p>
                            </div>
                        ) : connectionState === 'disconnected' ? (
                            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                                <p className="text-red-700 font-medium">{t('connectionLost') || 'Соединение потеряно'}</p>
                                <p className="text-sm text-red-600/80">
                                    {t('reconnecting') || 'Пытаемся переподключиться...'}
                                </p>
                            </div>
                        ) : (
                            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                                <p className="text-yellow-700 font-medium">{t('connecting') || 'Подключаемся...'}</p>
                            </div>
                        )}

                        <p className="text-sm text-muted-foreground">
                            {t('playingAs') || 'Играете как'} <span className="font-semibold text-foreground">{user?.username}</span>
                        </p>
                    </CardContent>
                </Card>

                <div className="text-center mt-8">
                    <Link href="/">
                        <Button variant="ghost">← {t('leaveLobby') || 'Покинуть лобби'}</Button>
                    </Link>
                </div>
            </main>
        </div>
    );
}
