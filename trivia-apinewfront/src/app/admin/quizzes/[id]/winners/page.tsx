'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { getQuizResults, getQuiz, Quiz, QuizResult } from '@/lib/api';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { toast } from 'sonner';

function WinnersPageContent() {
    const params = useParams();
    const quizId = Number(params.id);

    const [quiz, setQuiz] = useState<Quiz | null>(null);
    const [winners, setWinners] = useState<QuizResult[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [quizData, resultsData] = await Promise.all([
                    getQuiz(quizId),
                    getQuizResults(quizId, { page: 1, page_size: 100 })
                ]);

                setQuiz(quizData);
                const winnersList = resultsData.results.filter(r => r.is_winner);
                setWinners(winnersList);
            } catch (error) {
                console.error('Failed to fetch winners data:', error);
                toast.error('Ошибка загрузки данных');
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [quizId]);

    const getRankIcon = (rank: number) => {
        switch (rank) {
            case 1: return '🥇';
            case 2: return '🥈';
            case 3: return '🥉';
            default: return `#${rank}`;
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen">
                <header className="border-b border-border/50 bg-white/80 backdrop-blur-sm">
                    <div className="container max-w-6xl mx-auto px-4 h-16 flex items-center">
                        <Skeleton className="h-8 w-32" />
                    </div>
                </header>
                <main className="container max-w-4xl mx-auto px-4 py-8">
                    <Skeleton className="h-8 w-48 mb-8" />
                    <Skeleton className="h-64 w-full rounded-2xl" />
                </main>
            </div>
        );
    }

    if (!quiz) return <div className="p-8 text-center">Викторина не найдена</div>;

    const totalPrizePool = winners.reduce((sum, w) => sum + (w.prize_fund || 0), 0);

    return (
        <div className="min-h-screen">
            {/* Header */}
            <header className="border-b border-border/50 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
                <div className="container max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
                    <Link href="/" className="flex items-center gap-2">
                        <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
                            <span className="text-white font-bold text-lg">Q</span>
                        </div>
                        <span className="font-bold text-xl text-foreground">QazaQuiz</span>
                        <Badge className="bg-primary/10 text-primary border-0 ml-2">Админ</Badge>
                    </Link>
                    <Link href={`/admin/quizzes/${quizId}`}>
                        <Button variant="ghost">← Назад</Button>
                    </Link>
                </div>
            </header>

            <main className="container max-w-4xl mx-auto px-4 py-8">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold flex items-center gap-2">
                        🏆 Победители: {quiz.title}
                    </h1>
                    <p className="text-muted-foreground">
                        Проведена {new Date(quiz.scheduled_time).toLocaleDateString('ru-RU')}
                    </p>
                </div>

                {/* Stats */}
                <div className="grid gap-4 md:grid-cols-3 mb-8">
                    <Card className="card-elevated border-0 rounded-xl">
                        <CardContent className="pt-6 text-center">
                            <p className="text-3xl font-bold text-primary">{winners.length}</p>
                            <p className="text-muted-foreground text-sm">Победителей</p>
                        </CardContent>
                    </Card>
                    <Card className="card-elevated border-0 rounded-xl">
                        <CardContent className="pt-6 text-center">
                            <p className="text-3xl font-bold text-green-600">${totalPrizePool}</p>
                            <p className="text-muted-foreground text-sm">Призовой фонд</p>
                        </CardContent>
                    </Card>
                    <Card className="card-elevated border-0 rounded-xl">
                        <CardContent className="pt-6 text-center">
                            <Badge className="bg-gray-100 text-gray-700 border-0 text-lg px-3 py-1">Завершена</Badge>
                        </CardContent>
                    </Card>
                </div>

                {/* Winners List */}
                <Card className="card-elevated border-0 rounded-2xl">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <span className="text-xl">🏆</span>
                            Список победителей
                        </CardTitle>
                        <CardDescription>
                            Участники, ответившие правильно на все вопросы и разделившие призовой фонд.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {winners.length === 0 ? (
                            <div className="text-center py-12">
                                <span className="text-5xl mb-4 block">🏆</span>
                                <p className="text-muted-foreground">
                                    Победителей в этой викторине не найдено.
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {winners.map((winner) => (
                                    <div
                                        key={winner.id}
                                        className="flex items-center justify-between p-4 rounded-xl bg-yellow-50 border-2 border-yellow-200"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="flex-shrink-0 w-10 text-center text-2xl">
                                                {getRankIcon(winner.rank)}
                                            </div>
                                            <Avatar className="h-12 w-12 border-2 border-white shadow-sm">
                                                <AvatarImage src={winner.profile_picture} />
                                                <AvatarFallback className="bg-primary/10 text-primary">
                                                    {winner.username.substring(0, 2).toUpperCase()}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div>
                                                <div className="font-semibold text-lg">{winner.username}</div>
                                                <div className="text-sm text-muted-foreground">
                                                    Очки: {winner.score} • Верных: {winner.correct_answers}/{winner.total_questions}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-2xl font-bold text-green-600">
                                                +${winner.prize_fund}
                                            </div>
                                            <div className="text-xs text-muted-foreground">Приз</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </main>
        </div>
    );
}

export default function QuizWinnersPage() {
    return (
        <ProtectedRoute requireAdmin>
            <WinnersPageContent />
        </ProtectedRoute>
    );
}
