'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/providers/AuthProvider';
import { useQuizWebSocket, WSMessage } from '@/providers/QuizWebSocketProvider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { QuizQuestionEvent, AnswerResultEvent, QuizFinishEvent, QuestionOption } from '@/lib/api/types';
import { AdBreakOverlay } from '@/components/game/AdBreakOverlay';
import { useLocale } from '@/components/LanguageSwitcher';

interface QuizState {
    status: 'waiting' | 'question' | 'result' | 'eliminated' | 'finished';
    currentQuestion: QuizQuestionEvent | null;
    selectedAnswer: number | null;
    lastResult: AnswerResultEvent | null;
    timeRemaining: number;
    score: number;
    correctCount: number;
    isEliminated: boolean;
    eliminationReason: string;
}

interface AdBreakData {
    quiz_id: number;
    media_type: 'image' | 'video';
    media_url: string;
    duration_sec: number;
}

export default function QuizPlayPage() {
    const params = useParams();
    const router = useRouter();
    const quizId = Number(params.id);
    const { user } = useAuth();
    const { isConnected, connectionState, subscribe, sendAnswer, send } = useQuizWebSocket();

    const [quizState, setQuizState] = useState<QuizState>({
        status: 'waiting',
        currentQuestion: null,
        selectedAnswer: null,
        lastResult: null,
        timeRemaining: 0,
        score: 0,
        correctCount: 0,
        isEliminated: false,
        eliminationReason: '',
    });

    const [adBreak, setAdBreak] = useState<AdBreakData | null>(null);
    const [showAdOverlay, setShowAdOverlay] = useState(false);
    const [playerCount, setPlayerCount] = useState<number>(0);

    // Handle WebSocket messages
    const handleMessage = useCallback((msg: WSMessage) => {
        console.log('[Play] WS message:', msg.type, msg.data);

        switch (msg.type) {
            case 'quiz:question': {
                const question = msg.data as unknown as QuizQuestionEvent;
                setQuizState(prev => ({
                    ...prev,
                    status: 'question',
                    currentQuestion: question,
                    selectedAnswer: null,
                    lastResult: null,
                    timeRemaining: question.time_limit,
                }));
                break;
            }

            case 'quiz:timer': {
                setQuizState(prev => ({
                    ...prev,
                    timeRemaining: msg.data.remaining_seconds as number,
                }));
                break;
            }

            case 'quiz:answer_result': {
                const result = msg.data as unknown as AnswerResultEvent;
                setQuizState(prev => ({
                    ...prev,
                    status: result.is_eliminated ? 'eliminated' : 'result',
                    lastResult: result,
                    score: prev.score + result.points_earned,
                    correctCount: result.is_correct ? prev.correctCount + 1 : prev.correctCount,
                    isEliminated: result.is_eliminated,
                    eliminationReason: result.elimination_reason,
                }));
                break;
            }

            case 'quiz:answer_reveal': {
                const correctOption = msg.data.correct_option as number;
                setQuizState(prev => ({
                    ...prev,
                    lastResult: prev.lastResult
                        ? { ...prev.lastResult, correct_option: correctOption }
                        : {
                            question_id: prev.currentQuestion?.question_id ?? 0,
                            correct_option: correctOption,
                            your_answer: -1,
                            is_correct: false,
                            points_earned: 0,
                            time_taken_ms: 0,
                            is_eliminated: prev.isEliminated,
                            elimination_reason: prev.eliminationReason,
                            time_limit_exceeded: true,
                        },
                }));
                break;
            }

            case 'quiz:elimination': {
                setQuizState(prev => ({
                    ...prev,
                    status: 'eliminated',
                    isEliminated: true,
                    eliminationReason: msg.data.reason as string,
                }));
                toast.error((msg.data.message as string) || 'Вы выбыли из игры!');
                break;
            }

            case 'quiz:finish': {
                const finish = msg.data as unknown as QuizFinishEvent;
                setQuizState(prev => ({ ...prev, status: 'finished' }));
                toast.success(finish.message || 'Викторина завершена!');
                setTimeout(() => {
                    router.push(`/quiz/${quizId}/results`);
                }, 2000);
                break;
            }

            case 'quiz:results_available': {
                router.push(`/quiz/${quizId}/results`);
                break;
            }

            case 'quiz:state': {
                console.log('[Play] Received state resync:', msg.data);
                const state = msg.data as {
                    status?: string;
                    current_question?: QuizQuestionEvent;
                    time_remaining?: number;
                    is_eliminated?: boolean;
                    elimination_reason?: string;
                    score?: number;
                    correct_count?: number;
                    player_count?: number;
                };

                setQuizState(prev => ({
                    ...prev,
                    status: (state.current_question ? 'question' : (state.is_eliminated ? 'eliminated' : 'waiting')),
                    currentQuestion: state.current_question || null,
                    timeRemaining: state.time_remaining ?? 0,
                    isEliminated: state.is_eliminated ?? false,
                    eliminationReason: state.elimination_reason ?? '',
                    score: state.score ?? prev.score,
                    correctCount: state.correct_count ?? prev.correctCount,
                }));

                // Update player count from resync
                if (state.player_count !== undefined) {
                    setPlayerCount(state.player_count);
                }
                break;
            }

            case 'quiz:ad_break': {
                console.log('[Play] Ad break started:', msg.data);
                const adData = msg.data as unknown as AdBreakData;
                setAdBreak(adData);
                setShowAdOverlay(true);
                break;
            }

            case 'quiz:ad_break_end': {
                console.log('[Play] Ad break ended');
                setShowAdOverlay(false);
                setAdBreak(null);
                break;
            }

            case 'quiz:player_count': {
                if (msg.data?.player_count !== undefined) {
                    setPlayerCount(msg.data.player_count as number);
                }
                break;
            }

            case 'quiz:user_ready': {
                if (msg.data?.player_count !== undefined) {
                    setPlayerCount(msg.data.player_count as number);
                }
                break;
            }
        }
    }, [quizId, router]);

    useEffect(() => {
        const unsubscribe = subscribe(handleMessage);
        return () => unsubscribe();
    }, [subscribe, handleMessage]);

    useEffect(() => {
        if (isConnected && quizId) {
            console.log('[Play] Requesting initial state sync...');
            send('user:resync', { quiz_id: quizId });
        }
    }, [isConnected, quizId, send]);

    const handleAnswer = useCallback((optionId: number) => {
        if (quizState.selectedAnswer !== null || quizState.isEliminated) return;
        if (!quizState.currentQuestion) return;

        setQuizState(prev => ({ ...prev, selectedAnswer: optionId }));
        sendAnswer(quizState.currentQuestion.question_id, optionId);
    }, [quizState.selectedAnswer, quizState.isEliminated, quizState.currentQuestion, sendAnswer]);

    const { status, currentQuestion, selectedAnswer, lastResult, timeRemaining, score, correctCount, isEliminated } = quizState;

    // Получаем текущий язык из cookie
    const locale = useLocale();

    // Локализованный текст вопроса (с fallback на русский)
    const localizedQuestionText = useMemo(() => {
        if (!currentQuestion) return '';
        if (locale === 'kk' && currentQuestion.text_kk) {
            return currentQuestion.text_kk;
        }
        return currentQuestion.text;
    }, [currentQuestion, locale]);

    // Локализованные варианты ответа (с fallback на русский)
    const localizedOptions: QuestionOption[] = useMemo(() => {
        if (!currentQuestion) return [];
        if (locale === 'kk' && currentQuestion.options_kk && currentQuestion.options_kk.length > 0) {
            return currentQuestion.options_kk;
        }
        return currentQuestion.options;
    }, [currentQuestion, locale]);

    const getOptionStyle = (optionId: number) => {
        const base = 'w-full h-auto py-4 px-4 text-left justify-start transition-all';
        if (lastResult) {
            if (optionId === lastResult.correct_option) {
                return `${base} border-green-500 bg-green-50 text-green-700`;
            }
            if (optionId === selectedAnswer && !lastResult.is_correct) {
                return `${base} border-red-500 bg-red-50 text-red-700`;
            }
        }
        if (optionId === selectedAnswer) {
            return `${base} border-primary bg-primary/10 text-primary`;
        }
        return `${base} border-border hover:border-primary/50 hover:bg-primary/5`;
    };

    return (
        <>
            <AdBreakOverlay
                adData={adBreak}
                isVisible={showAdOverlay}
                onAdEnd={() => {
                    setShowAdOverlay(false);
                    setAdBreak(null);
                }}
            />

            <div className="min-h-screen">
                {/* Header */}
                <header className="border-b border-border/50 bg-white/80 backdrop-blur-sm sticky top-0 z-40">
                    <div className="container max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
                        <Link href="/" className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                                <span className="text-white font-bold">Q</span>
                            </div>
                            <span className="font-bold text-lg text-foreground hidden sm:inline">QazaQuiz</span>
                        </Link>

                        <div className="flex items-center gap-4">
                            <div className="text-center">
                                <p className="text-lg font-bold">{score}</p>
                                <p className="text-xs text-muted-foreground">Очки</p>
                            </div>
                            <div className="text-center">
                                <p className="text-lg font-bold text-green-600">{correctCount}</p>
                                <p className="text-xs text-muted-foreground">Верно</p>
                            </div>
                            <div className="text-center">
                                <p className="text-lg font-bold text-primary">{playerCount}</p>
                                <p className="text-xs text-muted-foreground">Онлайн</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            {connectionState === 'disconnected' && (
                                <Badge variant="destructive">Отключён</Badge>
                            )}
                            {connectionState === 'reconnecting' && (
                                <Badge variant="secondary">Подключение...</Badge>
                            )}
                            {isEliminated && (
                                <Badge className="bg-orange-100 text-orange-700 border-orange-200">Зритель</Badge>
                            )}
                        </div>
                    </div>
                </header>

                <main className="container max-w-xl mx-auto px-4 py-6">
                    {/* Player info */}
                    <p className="text-sm text-muted-foreground text-center mb-6">
                        Играете как <span className="font-semibold text-foreground">{user?.username}</span>
                    </p>

                    {/* Waiting state */}
                    {status === 'waiting' && (
                        <Card className="card-elevated border-0 rounded-2xl text-center py-16">
                            <CardContent>
                                <div className="animate-pulse">
                                    <span className="text-5xl mb-4 block">⏳</span>
                                    <p className="text-xl font-bold mb-2">Ожидаем следующий вопрос...</p>
                                    <p className="text-muted-foreground">Приготовьтесь!</p>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Question state */}
                    {(status === 'question' || status === 'result') && currentQuestion && (
                        <Card className="card-elevated border-0 rounded-2xl overflow-hidden">
                            <CardHeader className="bg-gradient-to-b from-primary/5 to-transparent">
                                <div className="flex items-center justify-between mb-4">
                                    <Badge variant="outline" className="text-sm">
                                        Вопрос {currentQuestion.number} из {currentQuestion.total_questions}
                                    </Badge>
                                    <div className={`text-2xl font-mono font-bold px-3 py-1 rounded-lg ${timeRemaining <= 5
                                        ? 'text-red-600 bg-red-50 animate-pulse'
                                        : 'text-foreground bg-secondary'
                                        }`}>
                                        {timeRemaining}с
                                    </div>
                                </div>
                                <CardTitle className="text-xl">{localizedQuestionText}</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3 pt-2">
                                {localizedOptions.map((option) => (
                                    <Button
                                        key={option.id}
                                        variant="outline"
                                        className={getOptionStyle(option.id)}
                                        onClick={() => handleAnswer(option.id)}
                                        disabled={selectedAnswer !== null || isEliminated}
                                    >
                                        <span className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center font-bold mr-3 flex-shrink-0">
                                            {String.fromCharCode(65 + option.id)}
                                        </span>
                                        <span className="flex-1">{option.text}</span>
                                    </Button>
                                ))}

                                {/* Result feedback */}
                                {lastResult && (
                                    <div className={`mt-4 p-4 rounded-xl border-2 ${lastResult.is_correct
                                        ? 'border-green-300 bg-green-50'
                                        : 'border-red-300 bg-red-50'
                                        }`}>
                                        <p className={`font-bold text-lg ${lastResult.is_correct ? 'text-green-700' : 'text-red-700'}`}>
                                            {lastResult.is_correct ? '✓ Верно!' : '✗ Неверно!'}
                                        </p>
                                        <p className="text-sm text-muted-foreground mt-1">
                                            +{lastResult.points_earned} очков • {lastResult.time_taken_ms}мс
                                        </p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    )}

                    {/* Eliminated state */}
                    {status === 'eliminated' && (
                        <Card className="card-elevated border-0 rounded-2xl text-center py-16 border-2 border-orange-200">
                            <CardContent>
                                <span className="text-5xl mb-4 block">👀</span>
                                <p className="text-xl font-bold text-orange-700 mb-2">Вы выбыли из игры</p>
                                <p className="text-muted-foreground">Вы можете продолжить смотреть как зритель.</p>
                            </CardContent>
                        </Card>
                    )}

                    {/* Finished state */}
                    {status === 'finished' && (
                        <Card className="card-elevated border-0 rounded-2xl text-center py-16">
                            <CardContent>
                                <span className="text-5xl mb-4 block">🎉</span>
                                <p className="text-2xl font-bold mb-4">Викторина завершена!</p>
                                <div className="flex justify-center gap-8 mb-6">
                                    <div>
                                        <p className="text-3xl font-bold text-primary">{score}</p>
                                        <p className="text-muted-foreground">Очков</p>
                                    </div>
                                    <div>
                                        <p className="text-3xl font-bold text-green-600">{correctCount}</p>
                                        <p className="text-muted-foreground">Верных ответов</p>
                                    </div>
                                </div>
                                <Button
                                    className="btn-coral px-8"
                                    size="lg"
                                    onClick={() => router.push(`/quiz/${quizId}/results`)}
                                >
                                    Посмотреть результаты
                                </Button>
                            </CardContent>
                        </Card>
                    )}
                </main>
            </div>
        </>
    );
}
