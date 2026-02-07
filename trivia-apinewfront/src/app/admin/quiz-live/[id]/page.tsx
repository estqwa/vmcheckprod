'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { getQuiz, Quiz, getWsTicket } from '@/lib/api';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

// Типы для событий adaptive:question_stats
interface AdaptiveQuestionStats {
    quiz_id: number;
    question_number: number;
    difficulty_used: number;
    target_pass_rate: number;
    actual_pass_rate: number;
    total_answers: number;
    passed_count: number;
    remaining_players: number;
    timestamp: string;
}

interface QuestionStats {
    questionNumber: number;
    difficulty: number;
    targetPassRate: number;
    actualPassRate: number;
    totalAnswers: number;
    passedCount: number;
    remainingPlayers: number;
    timestamp: string;
}

type WSConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

function getWSUrl() {
    const baseUrl = process.env.NEXT_PUBLIC_WS_URL ||
        (typeof window !== 'undefined' ? window.location.origin.replace(/^http/, 'ws') : 'ws://localhost:8080');
    return `${baseUrl}/ws`;
}

function QuizLivePageContent() {
    const params = useParams();
    const quizId = Number(params.id);

    const [quiz, setQuiz] = useState<Quiz | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // WebSocket state
    const [wsState, setWsState] = useState<WSConnectionState>('disconnected');
    const wsRef = useRef<WebSocket | null>(null);

    // Live stats
    const [currentQuestion, setCurrentQuestion] = useState<number>(0);
    const [remainingPlayers, setRemainingPlayers] = useState<number>(0);
    const [questionHistory, setQuestionHistory] = useState<QuestionStats[]>([]);
    const [quizStatus, setQuizStatus] = useState<'waiting' | 'active' | 'finished'>('waiting');

    // Difficulty colors
    const difficultyColors: Record<number, string> = {
        1: 'bg-green-100 text-green-700',
        2: 'bg-lime-100 text-lime-700',
        3: 'bg-yellow-100 text-yellow-700',
        4: 'bg-orange-100 text-orange-700',
        5: 'bg-red-100 text-red-700',
    };

    const difficultyLabels: Record<number, string> = {
        1: '⭐ Очень легко',
        2: '⭐⭐ Легко',
        3: '⭐⭐⭐ Средне',
        4: '⭐⭐⭐⭐ Сложно',
        5: '⭐⭐⭐⭐⭐ Очень сложно',
    };

    // Connect to WebSocket
    const connectWS = useCallback(async () => {
        try {
            setWsState('connecting');

            // Получаем ticket для WebSocket
            const ticket = await getWsTicket();

            const ws = new WebSocket(`${getWSUrl()}?ticket=${ticket}`);
            wsRef.current = ws;

            ws.onopen = () => {
                setWsState('connected');
                console.log('[QuizLive] WebSocket connected');

                // ВАЖНО: подписываемся на конкретный quiz через user:ready
                ws.send(JSON.stringify({
                    type: 'user:ready',
                    data: { quiz_id: quizId }
                }));
                console.log('[QuizLive] Subscribed to quiz:', quizId);
            };

            ws.onmessage = (event) => {
                try {
                    const msg = JSON.parse(event.data);
                    console.log('[QuizLive] Received:', msg.type);

                    switch (msg.type) {
                        case 'quiz:started':
                            setQuizStatus('active');
                            setRemainingPlayers(msg.data?.total_participants || 0);
                            break;

                        case 'quiz:question':
                            setCurrentQuestion(msg.data?.number || 0);
                            break;

                        case 'adaptive:question_stats': {
                            const data = msg.data as AdaptiveQuestionStats;
                            setRemainingPlayers(data.passed_count); // passed_count = активные (прошедшие вопрос)

                            const stats: QuestionStats = {
                                questionNumber: data.question_number,
                                difficulty: data.difficulty_used,
                                targetPassRate: data.target_pass_rate,
                                actualPassRate: data.actual_pass_rate,
                                totalAnswers: data.total_answers,
                                passedCount: data.passed_count,
                                remainingPlayers: data.remaining_players,
                                timestamp: data.timestamp,
                            };

                            setQuestionHistory(prev => [...prev, stats]);
                            break;
                        }

                        case 'quiz:ended':
                        case 'quiz:results_available':
                            setQuizStatus('finished');
                            break;
                    }
                } catch (err) {
                    console.error('[QuizLive] Parse error:', err);
                }
            };

            ws.onerror = () => {
                setWsState('error');
            };

            ws.onclose = () => {
                setWsState('disconnected');
                console.log('[QuizLive] WebSocket closed');
            };

        } catch (err) {
            console.error('[QuizLive] Connect error:', err);
            setWsState('error');
        }
    }, [quizId]);

    // Disconnect
    const disconnectWS = useCallback(() => {
        if (wsRef.current) {
            wsRef.current.close();
            wsRef.current = null;
        }
        setWsState('disconnected');
    }, []);

    // Fetch quiz info
    useEffect(() => {
        const fetchQuiz = async () => {
            try {
                const quizData = await getQuiz(quizId);
                setQuiz(quizData);

                // Определяем статус
                if (quizData.status === 'in_progress') {
                    setQuizStatus('active');
                } else if (quizData.status === 'completed') {
                    setQuizStatus('finished');
                }
            } catch (err) {
                console.error('Failed to fetch quiz:', err);
                setError('Не удалось загрузить викторину');
            } finally {
                setIsLoading(false);
            }
        };

        fetchQuiz();
    }, [quizId]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            disconnectWS();
        };
    }, [disconnectWS]);

    if (isLoading) {
        return (
            <div className="min-h-screen">
                <header className="border-b border-border/50 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
                    <div className="container max-w-6xl mx-auto px-4 h-16 flex items-center">
                        <Skeleton className="h-6 w-48" />
                    </div>
                </header>
                <main className="container max-w-5xl mx-auto px-4 py-8">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                        {[...Array(4)].map((_, i) => (
                            <Skeleton key={i} className="h-28 w-full rounded-xl" />
                        ))}
                    </div>
                </main>
            </div>
        );
    }

    if (error || !quiz) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Card className="max-w-md">
                    <CardContent className="pt-6 text-center">
                        <span className="text-5xl mb-4 block">📡</span>
                        <p className="text-muted-foreground mb-4">{error || 'Викторина не найдена'}</p>
                        <Link href="/admin">
                            <Button>← Назад</Button>
                        </Link>
                    </CardContent>
                </Card>
            </div>
        );
    }

    const lastStats = questionHistory[questionHistory.length - 1];

    return (
        <div className="min-h-screen">
            {/* Header */}
            <header className="border-b border-border/50 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
                <div className="container max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href={`/admin/quizzes/${quizId}`}>
                            <Button variant="ghost" size="sm">← Назад</Button>
                        </Link>
                        <div>
                            <h1 className="font-bold">{quiz.title}</h1>
                            <p className="text-xs text-muted-foreground">Realtime мониторинг</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        {/* Status badge */}
                        <span className={`text-xs px-2 py-1 rounded-full ${quizStatus === 'active' ? 'bg-green-100 text-green-700' :
                            quizStatus === 'finished' ? 'bg-gray-100 text-gray-700' :
                                'bg-yellow-100 text-yellow-700'
                            }`}>
                            {quizStatus === 'active' ? '🟢 Активна' :
                                quizStatus === 'finished' ? '✅ Завершена' : '⏳ Ожидает'}
                        </span>

                        {/* Connection button */}
                        {wsState === 'connected' ? (
                            <Button variant="outline" size="sm" onClick={disconnectWS}>
                                🔌 Отключиться
                            </Button>
                        ) : (
                            <Button
                                size="sm"
                                onClick={connectWS}
                                disabled={wsState === 'connecting'}
                            >
                                {wsState === 'connecting' ? '⏳ Подключение...' : '📡 Подключиться'}
                            </Button>
                        )}
                    </div>
                </div>
            </header>

            <main className="container max-w-5xl mx-auto px-4 py-8">
                <h2 className="text-2xl font-bold mb-6">📡 Live мониторинг</h2>

                {/* Connection Status */}
                <Card className={`mb-6 ${wsState === 'connected' ? 'border-green-200 bg-green-50/50' :
                    wsState === 'error' ? 'border-red-200 bg-red-50/50' :
                        'border-gray-200'
                    }`}>
                    <CardContent className="py-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <span className={`w-3 h-3 rounded-full ${wsState === 'connected' ? 'bg-green-500 animate-pulse' :
                                wsState === 'connecting' ? 'bg-yellow-500 animate-pulse' :
                                    wsState === 'error' ? 'bg-red-500' : 'bg-gray-400'
                                }`} />
                            <span className="font-medium">
                                {wsState === 'connected' ? 'Подключено к викторине' :
                                    wsState === 'connecting' ? 'Подключение...' :
                                        wsState === 'error' ? 'Ошибка подключения' :
                                            'Не подключено'}
                            </span>
                        </div>
                        {wsState === 'connected' && (
                            <span className="text-sm text-muted-foreground">
                                Получено событий: {questionHistory.length}
                            </span>
                        )}
                    </CardContent>
                </Card>

                {/* Current Stats */}
                {wsState === 'connected' && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                        <Card>
                            <CardContent className="pt-6">
                                <p className="text-3xl font-bold">{currentQuestion || '-'}</p>
                                <p className="text-sm text-muted-foreground">Текущий вопрос</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="pt-6">
                                <p className="text-3xl font-bold">{remainingPlayers}</p>
                                <p className="text-sm text-muted-foreground">Активных игроков</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="pt-6">
                                <p className={`text-3xl font-bold ${difficultyColors[lastStats?.difficulty || 0]?.split(' ')[1] || ''}`}>
                                    {lastStats?.difficulty || '-'}
                                </p>
                                <p className="text-sm text-muted-foreground">Текущая сложность</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="pt-6">
                                <p className={`text-3xl font-bold ${lastStats && Math.abs(lastStats.actualPassRate - lastStats.targetPassRate) < 0.1
                                    ? 'text-green-600' : 'text-yellow-600'
                                    }`}>
                                    {lastStats ? `${(lastStats.actualPassRate * 100).toFixed(0)}%` : '-'}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                    Pass Rate {lastStats ? `(цель ${(lastStats.targetPassRate * 100).toFixed(0)}%)` : ''}
                                </p>
                            </CardContent>
                        </Card>
                    </div>
                )}

                {/* Question History */}
                <Card className="card-elevated border-0 rounded-2xl">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <span className="text-xl">📊</span>
                            История вопросов
                        </CardTitle>
                        <CardDescription>Статистика по каждому вопросу в реальном времени</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {questionHistory.length === 0 ? (
                            <p className="text-center text-muted-foreground py-8">
                                {wsState === 'connected'
                                    ? 'Ожидание данных... Статистика появится после завершения первого вопроса.'
                                    : 'Подключитесь к викторине для просмотра live данных.'}
                            </p>
                        ) : (
                            <div className="space-y-3">
                                {questionHistory.map((q) => {
                                    const passRateDiff = q.actualPassRate - q.targetPassRate;
                                    const isOnTarget = Math.abs(passRateDiff) < 0.1;

                                    return (
                                        <div key={q.questionNumber} className="flex items-center gap-4 p-3 bg-secondary/20 rounded-lg">
                                            <div className="w-24 text-sm font-medium flex items-center gap-2">
                                                Вопрос {q.questionNumber}
                                                <span className={`text-xs px-1.5 py-0.5 rounded ${difficultyColors[q.difficulty] || 'bg-gray-100'}`}>
                                                    {q.difficulty}
                                                </span>
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <div className="flex-1 h-2 bg-secondary/50 rounded-full overflow-hidden">
                                                        <div
                                                            className={`h-full rounded-full transition-all ${isOnTarget ? 'bg-green-500' : 'bg-yellow-500'
                                                                }`}
                                                            style={{ width: `${q.actualPassRate * 100}%` }}
                                                        />
                                                    </div>
                                                    <span className={`text-sm font-medium ${isOnTarget ? 'text-green-600' : 'text-yellow-600'
                                                        }`}>
                                                        {(q.actualPassRate * 100).toFixed(0)}%
                                                    </span>
                                                </div>
                                                <p className="text-xs text-muted-foreground">
                                                    Цель: {(q.targetPassRate * 100).toFixed(0)}% |
                                                    Прошли: {q.passedCount}/{q.totalAnswers} |
                                                    Осталось: {q.remainingPlayers}
                                                </p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </main>
        </div>
    );
}

export default function QuizLivePage() {
    return (
        <ProtectedRoute requireAdmin>
            <QuizLivePageContent />
        </ProtectedRoute>
    );
}
