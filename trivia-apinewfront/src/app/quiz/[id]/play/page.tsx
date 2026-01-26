'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/providers/AuthProvider';
import { useQuizWebSocket, WSMessage } from '@/providers/QuizWebSocketProvider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { QuizQuestionEvent, AnswerResultEvent, QuizFinishEvent } from '@/lib/api/types';

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

export default function QuizPlayPage() {
    const params = useParams();
    const router = useRouter();
    const quizId = Number(params.id);
    const { user } = useAuth();
    const { isConnected, connectionState, subscribe, sendAnswer } = useQuizWebSocket();

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
                toast.error((msg.data.message as string) || 'You have been eliminated!');
                break;
            }

            case 'quiz:finish': {
                const finish = msg.data as unknown as QuizFinishEvent;
                setQuizState(prev => ({ ...prev, status: 'finished' }));
                toast.success(finish.message || 'Quiz finished!');
                setTimeout(() => {
                    router.push(`/quiz/${quizId}/results`);
                }, 2000);
                break;
            }

            case 'quiz:results_available': {
                router.push(`/quiz/${quizId}/results`);
                break;
            }

            // Handle resync - restore state after reconnect
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
                };

                if (state.current_question) {
                    setQuizState(prev => ({
                        ...prev,
                        status: state.is_eliminated ? 'eliminated' : 'question',
                        currentQuestion: state.current_question!,
                        timeRemaining: state.time_remaining ?? 0,
                        isEliminated: state.is_eliminated ?? false,
                        eliminationReason: state.elimination_reason ?? '',
                        score: state.score ?? prev.score,
                        correctCount: state.correct_count ?? prev.correctCount,
                    }));
                }
                break;
            }
        }
    }, [quizId, router]);

    // Subscribe to messages
    useEffect(() => {
        const unsubscribe = subscribe(handleMessage);
        return () => unsubscribe();
    }, [subscribe, handleMessage]);

    // Handle answer selection
    const handleAnswer = useCallback((optionId: number) => {
        if (quizState.selectedAnswer !== null || quizState.isEliminated) return;
        if (!quizState.currentQuestion) return;

        setQuizState(prev => ({ ...prev, selectedAnswer: optionId }));
        sendAnswer(quizState.currentQuestion.question_id, optionId);
    }, [quizState.selectedAnswer, quizState.isEliminated, quizState.currentQuestion, sendAnswer]);

    const { status, currentQuestion, selectedAnswer, lastResult, timeRemaining, score, correctCount, isEliminated } = quizState;

    // Get option style based on state
    const getOptionStyle = (optionId: number) => {
        if (lastResult) {
            if (optionId === lastResult.correct_option) {
                return 'border-green-500 bg-green-500/20 text-green-500';
            }
            if (optionId === selectedAnswer && !lastResult.is_correct) {
                return 'border-red-500 bg-red-500/20 text-red-500';
            }
        }
        if (optionId === selectedAnswer) {
            return 'border-primary bg-primary/20';
        }
        return 'border-border hover:border-primary/50';
    };

    return (
        <main className="container max-w-xl mx-auto px-4 py-8 min-h-screen">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <p className="text-sm text-muted-foreground">Playing as {user?.username}</p>
                    <p className="font-bold">Score: {score} | Correct: {correctCount}</p>
                </div>
                <div className="flex items-center gap-2">
                    {connectionState === 'disconnected' && (
                        <Badge variant="destructive">Disconnected</Badge>
                    )}
                    {connectionState === 'connecting' && (
                        <Badge variant="secondary">Connecting...</Badge>
                    )}
                    {connectionState === 'reconnecting' && (
                        <Badge variant="secondary">Reconnecting...</Badge>
                    )}
                    {isEliminated && (
                        <Badge variant="destructive">Spectator Mode</Badge>
                    )}
                </div>
            </div>

            {/* Waiting state */}
            {status === 'waiting' && (
                <Card className="text-center py-16">
                    <CardContent>
                        <div className="animate-pulse">
                            <p className="text-xl font-bold mb-2">Waiting for next question...</p>
                            <p className="text-muted-foreground">Get ready!</p>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Question state */}
            {(status === 'question' || status === 'result') && currentQuestion && (
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <Badge variant="outline">
                                Q{currentQuestion.number} of {currentQuestion.total_questions}
                            </Badge>
                            <div className={`text-2xl font-mono font-bold ${timeRemaining <= 5 ? 'text-red-500 animate-pulse' : ''}`}>
                                {timeRemaining}s
                            </div>
                        </div>
                        <CardTitle className="text-xl mt-4">{currentQuestion.text}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {currentQuestion.options.map((option) => (
                            <Button
                                key={option.id}
                                variant="outline"
                                className={`w-full h-auto py-4 px-4 text-left justify-start ${getOptionStyle(option.id)}`}
                                onClick={() => handleAnswer(option.id)}
                                disabled={selectedAnswer !== null || isEliminated}
                            >
                                <span className="font-medium mr-3">{String.fromCharCode(65 + option.id)}.</span>
                                {option.text}
                            </Button>
                        ))}

                        {/* Result feedback */}
                        {lastResult && (
                            <div className={`mt-4 p-4 rounded-lg border ${lastResult.is_correct ? 'border-green-500 bg-green-500/10' : 'border-red-500 bg-red-500/10'}`}>
                                <p className={`font-bold ${lastResult.is_correct ? 'text-green-500' : 'text-red-500'}`}>
                                    {lastResult.is_correct ? '✓ Correct!' : '✗ Wrong!'}
                                </p>
                                <p className="text-sm text-muted-foreground mt-1">
                                    +{lastResult.points_earned} points • {lastResult.time_taken_ms}ms
                                </p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Eliminated state */}
            {status === 'eliminated' && !currentQuestion && (
                <Card className="text-center py-16 border-red-500/50">
                    <CardContent>
                        <p className="text-4xl mb-4">💀</p>
                        <p className="text-xl font-bold text-red-500 mb-2">You&apos;ve been eliminated!</p>
                        <p className="text-muted-foreground">You can continue watching as a spectator.</p>
                    </CardContent>
                </Card>
            )}

            {/* Finished state */}
            {status === 'finished' && (
                <Card className="text-center py-16">
                    <CardContent>
                        <p className="text-4xl mb-4">🎉</p>
                        <p className="text-xl font-bold mb-2">Quiz Complete!</p>
                        <p className="text-muted-foreground">Final Score: {score}</p>
                        <p className="text-muted-foreground">Correct Answers: {correctCount}</p>
                        <Button className="mt-6" onClick={() => router.push(`/quiz/${quizId}/results`)}>
                            View Results
                        </Button>
                    </CardContent>
                </Card>
            )}
        </main>
    );
}
