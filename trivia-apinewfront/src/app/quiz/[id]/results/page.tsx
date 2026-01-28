'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { getQuiz, getQuizResults, getMyResult, Quiz, QuizResult, PaginatedResults } from '@/lib/api';
import { useAuth } from '@/providers/AuthProvider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

export default function QuizResultsPage() {
    const params = useParams();
    const router = useRouter();
    const quizId = Number(params.id);
    const { user, isAuthenticated } = useAuth();

    const [quiz, setQuiz] = useState<Quiz | null>(null);
    const [results, setResults] = useState<PaginatedResults<QuizResult> | null>(null);
    const [myResult, setMyResult] = useState<QuizResult | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [quizData, resultsData] = await Promise.all([
                    getQuiz(quizId),
                    getQuizResults(quizId, { page: 1, page_size: 20 }),
                ]);
                setQuiz(quizData);
                setResults(resultsData);

                if (isAuthenticated) {
                    const myResultData = await getMyResult(quizId);
                    setMyResult(myResultData);
                }
            } catch (error) {
                console.error('Failed to fetch results:', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [quizId, isAuthenticated]);

    if (isLoading) {
        return (
            <div className="min-h-screen">
                <header className="border-b border-border/50 bg-white/80 backdrop-blur-sm">
                    <div className="container max-w-6xl mx-auto px-4 h-16 flex items-center">
                        <Skeleton className="h-8 w-32" />
                    </div>
                </header>
                <main className="container max-w-3xl mx-auto px-4 py-12">
                    <Skeleton className="h-8 w-48 mb-8" />
                    <Skeleton className="h-48 w-full mb-6 rounded-2xl" />
                    <Skeleton className="h-64 w-full rounded-2xl" />
                </main>
            </div>
        );
    }

    return (
        <div className="min-h-screen pb-24 md:pb-0">
            {/* Header */}
            <header className="border-b border-border/50 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
                <div className="container max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
                    <Link href="/" className="flex items-center gap-2">
                        <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
                            <span className="text-white font-bold text-lg">Q</span>
                        </div>
                        <span className="font-bold text-xl text-foreground">QazaQuiz</span>
                    </Link>
                    <Link href="/">
                        <Button variant="ghost">← На главную</Button>
                    </Link>
                </div>
            </header>

            <main className="container max-w-3xl mx-auto px-4 py-8">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold">Результаты</h1>
                    {quiz && <p className="text-muted-foreground">{quiz.title}</p>}
                </div>

                {/* My Result Card */}
                {myResult && (
                    <Card className={`mb-6 card-elevated border-0 rounded-2xl overflow-hidden ${myResult.is_winner ? 'ring-2 ring-yellow-400' : ''
                        }`}>
                        <CardHeader className={`${myResult.is_winner
                                ? 'bg-gradient-to-r from-yellow-50 to-orange-50'
                                : myResult.is_eliminated
                                    ? 'bg-gradient-to-r from-orange-50 to-red-50'
                                    : 'bg-gradient-to-b from-primary/5 to-transparent'
                            }`}>
                            <CardTitle className="flex items-center gap-2">
                                <span className="text-2xl">{myResult.is_winner ? '🏆' : myResult.is_eliminated ? '👀' : '📊'}</span>
                                Ваш результат
                                {myResult.is_winner && <Badge className="bg-yellow-400 text-yellow-900 border-0">Победитель!</Badge>}
                                {myResult.is_eliminated && <Badge className="bg-orange-100 text-orange-700 border-0">Выбыл</Badge>}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="bg-secondary/50 rounded-xl p-4 text-center">
                                    <p className="text-3xl font-bold">#{myResult.rank}</p>
                                    <p className="text-muted-foreground text-sm">Место</p>
                                </div>
                                <div className="bg-primary/10 rounded-xl p-4 text-center">
                                    <p className="text-3xl font-bold text-primary">{myResult.score}</p>
                                    <p className="text-muted-foreground text-sm">Очков</p>
                                </div>
                                <div className="bg-secondary/50 rounded-xl p-4 text-center">
                                    <p className="text-3xl font-bold">{myResult.correct_answers}/{myResult.total_questions}</p>
                                    <p className="text-muted-foreground text-sm">Верно</p>
                                </div>
                                {myResult.prize_fund > 0 && (
                                    <div className="bg-green-50 rounded-xl p-4 text-center">
                                        <p className="text-3xl font-bold text-green-600">${myResult.prize_fund}</p>
                                        <p className="text-muted-foreground text-sm">Приз</p>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* All Results */}
                <Card className="card-elevated border-0 rounded-2xl">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <span className="text-xl">🏆</span>
                            Таблица лидеров
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {!results || results.results.length === 0 ? (
                            <div className="text-center py-12">
                                <span className="text-5xl mb-4 block">📊</span>
                                <p className="text-muted-foreground">Результатов пока нет</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {results.results.map((result) => (
                                    <div
                                        key={result.id}
                                        className={`flex items-center gap-4 p-4 rounded-xl border-2 transition-all ${result.user_id === user?.id
                                                ? 'border-primary/50 bg-primary/5'
                                                : result.is_winner
                                                    ? 'border-yellow-300 bg-yellow-50'
                                                    : 'border-transparent bg-secondary/30'
                                            }`}
                                    >
                                        {/* Rank */}
                                        <div className="w-10 text-center flex-shrink-0">
                                            {result.rank <= 3 ? (
                                                <span className="text-2xl">
                                                    {result.rank === 1 ? '🥇' : result.rank === 2 ? '🥈' : '🥉'}
                                                </span>
                                            ) : (
                                                <span className="font-bold text-lg text-muted-foreground">#{result.rank}</span>
                                            )}
                                        </div>

                                        {/* Avatar & Name */}
                                        <Avatar className="h-10 w-10 border-2 border-white shadow-sm">
                                            <AvatarImage src={result.profile_picture} />
                                            <AvatarFallback className="bg-primary/10 text-primary text-sm">
                                                {result.username.substring(0, 2).toUpperCase()}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium truncate">
                                                {result.username}
                                                {result.user_id === user?.id && <span className="text-muted-foreground"> (Вы)</span>}
                                            </p>
                                            <p className="text-sm text-muted-foreground">
                                                {result.correct_answers}/{result.total_questions} верных
                                            </p>
                                        </div>

                                        {/* Stats */}
                                        <div className="flex items-center gap-2">
                                            <Badge variant="outline" className="font-bold">{result.score} очков</Badge>
                                            {result.prize_fund > 0 && (
                                                <Badge className="bg-green-500 border-0">${result.prize_fund}</Badge>
                                            )}
                                            {result.is_eliminated && (
                                                <Badge className="bg-orange-100 text-orange-700 border-0 text-xs">Выбыл</Badge>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                <div className="text-center mt-8">
                    <Button className="btn-coral px-8" size="lg" onClick={() => router.push('/')}>
                        На главную
                    </Button>
                </div>
            </main>

            {/* Mobile Navigation */}
            <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-border/50 py-2 px-4">
                <div className="flex justify-around">
                    <Link href="/" className="flex flex-col items-center text-muted-foreground">
                        <span className="text-xl">🏠</span>
                        <span className="text-xs">Главная</span>
                    </Link>
                    <Link href="/leaderboard" className="flex flex-col items-center text-muted-foreground">
                        <span className="text-xl">🏆</span>
                        <span className="text-xs">Рейтинг</span>
                    </Link>
                    {isAuthenticated && (
                        <Link href="/profile" className="flex flex-col items-center text-muted-foreground">
                            <span className="text-xl">👤</span>
                            <span className="text-xs">Профиль</span>
                        </Link>
                    )}
                </div>
            </div>
        </div>
    );
}
