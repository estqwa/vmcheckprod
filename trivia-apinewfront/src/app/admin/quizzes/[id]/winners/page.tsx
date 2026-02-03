'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { getQuizResults, getQuiz, getQuizStatistics, getQuizWinners, Quiz, QuizResult, QuizStatistics } from '@/lib/api';
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
    const [allResults, setAllResults] = useState<QuizResult[]>([]);
    const [showAllParticipants, setShowAllParticipants] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [statistics, setStatistics] = useState<QuizStatistics | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const PAGE_SIZE = 50;

    const translateEliminationReason = (reason?: string): string => {
        if (!reason) return '';
        switch (reason) {
            case 'time_exceeded':
            case 'no_answer_timeout':
                return 'Время истекло';
            case 'incorrect_answer':
                return 'Неверный ответ';
            case 'disconnected':
                return 'Отключился';
            default:
                return reason;
        }
    };

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [quizData, winnersData, statsData] = await Promise.all([
                    getQuiz(quizId),
                    getQuizWinners(quizId), // Используем новый API для победителей
                    getQuizStatistics(quizId)
                ]);

                setQuiz(quizData);
                setStatistics(statsData);
                setWinners(winnersData.winners);

                // Загружаем выбывших с пагинацией
                await loadEliminatedPage(1);
            } catch (error) {
                console.error('Failed to fetch winners data:', error);
                toast.error('Ошибка загрузки данных');
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [quizId]);

    // Функция загрузки страницы выбывших
    const loadEliminatedPage = async (page: number) => {
        try {
            const resultsData = await getQuizResults(quizId, { page, page_size: PAGE_SIZE });
            setAllResults(resultsData.results);
            setTotalPages(Math.ceil(resultsData.total / PAGE_SIZE));
            setCurrentPage(page);
        } catch (error) {
            console.error('Failed to load eliminated page:', error);
        }
    };

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
    const eliminatedParticipants = allResults.filter(r => r.is_eliminated);

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
                        🏆 Результаты: {quiz.title}
                    </h1>
                    <p className="text-muted-foreground">
                        Проведена {new Date(quiz.scheduled_time).toLocaleDateString('ru-RU')}
                    </p>
                </div>

                {/* Stats - используем statistics API для точных счётчиков */}
                <div className="grid gap-4 md:grid-cols-4 mb-8">
                    <Card className="card-elevated border-0 rounded-xl">
                        <CardContent className="pt-6 text-center">
                            <p className="text-3xl font-bold text-primary">{statistics?.total_winners ?? winners.length}</p>
                            <p className="text-muted-foreground text-sm">Победителей</p>
                        </CardContent>
                    </Card>
                    <Card className="card-elevated border-0 rounded-xl">
                        <CardContent className="pt-6 text-center">
                            <p className="text-3xl font-bold text-red-500">{statistics?.total_eliminated ?? eliminatedParticipants.length}</p>
                            <p className="text-muted-foreground text-sm">Выбыло</p>
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
                            <p className="text-3xl font-bold">{statistics?.total_participants ?? allResults.length}</p>
                            <p className="text-muted-foreground text-sm">Всего участников</p>
                        </CardContent>
                    </Card>
                </div>

                {/* Winners List */}
                <Card className="card-elevated border-0 rounded-2xl mb-6">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <span className="text-xl">🏆</span>
                            Победители
                        </CardTitle>
                        <CardDescription>
                            Участники, ответившие правильно на все вопросы.
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

                {/* Eliminated Participants */}
                {eliminatedParticipants.length > 0 && (
                    <Card className="card-elevated border-0 rounded-2xl">
                        <CardHeader className="cursor-pointer" onClick={() => setShowAllParticipants(!showAllParticipants)}>
                            <CardTitle className="flex items-center justify-between">
                                <span className="flex items-center gap-2">
                                    <span className="text-xl">💔</span>
                                    Выбывшие участники ({eliminatedParticipants.length})
                                </span>
                                <Button variant="ghost" size="sm">
                                    {showAllParticipants ? '▲ Свернуть' : '▼ Развернуть'}
                                </Button>
                            </CardTitle>
                        </CardHeader>
                        {showAllParticipants && (
                            <CardContent>
                                <div className="space-y-2">
                                    {eliminatedParticipants.map((participant) => (
                                        <div
                                            key={participant.id}
                                            className="flex items-center justify-between p-3 rounded-xl bg-secondary/30"
                                        >
                                            <div className="flex items-center gap-3">
                                                <Avatar className="h-10 w-10">
                                                    <AvatarImage src={participant.profile_picture} />
                                                    <AvatarFallback className="bg-muted text-muted-foreground">
                                                        {participant.username.substring(0, 2).toUpperCase()}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <div>
                                                    <div className="font-medium">{participant.username}</div>
                                                    <div className="text-sm text-muted-foreground">
                                                        Очки: {participant.score} • Верных: {participant.correct_answers}/{participant.total_questions}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                {participant.eliminated_on_question && (
                                                    <Badge variant="outline" className="text-red-600 border-red-300">
                                                        Вопрос #{participant.eliminated_on_question}
                                                    </Badge>
                                                )}
                                                {participant.elimination_reason && (
                                                    <p className="text-xs text-muted-foreground mt-1">
                                                        {translateEliminationReason(participant.elimination_reason)}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Пагинация */}
                                {totalPages > 1 && (
                                    <div className="flex items-center justify-center gap-2 mt-4 pt-4 border-t">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            disabled={currentPage === 1}
                                            onClick={() => loadEliminatedPage(currentPage - 1)}
                                        >
                                            ← Назад
                                        </Button>
                                        <span className="text-sm text-muted-foreground px-4">
                                            Страница {currentPage} из {totalPages}
                                        </span>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            disabled={currentPage === totalPages}
                                            onClick={() => loadEliminatedPage(currentPage + 1)}
                                        >
                                            Вперёд →
                                        </Button>
                                    </div>
                                )}
                            </CardContent>
                        )}
                    </Card>
                )}
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
