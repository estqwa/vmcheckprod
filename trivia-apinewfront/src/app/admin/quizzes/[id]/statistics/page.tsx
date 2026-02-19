'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { getQuiz, getQuizStatistics, Quiz, QuizStatistics } from '@/lib/api';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { BackButton } from '@/components/BackButton';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

function StatCard({ title, value, subtitle, icon, color = 'primary' }: {
    title: string;
    value: string | number;
    subtitle?: string;
    icon: string;
    color?: 'primary' | 'green' | 'red' | 'yellow';
}) {
    const colors = {
        primary: 'bg-primary/10 text-primary',
        green: 'bg-green-100 text-green-700',
        red: 'bg-red-100 text-red-700',
        yellow: 'bg-yellow-100 text-yellow-700',
    };

    return (
        <Card className="card-elevated border-0 rounded-xl">
            <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl ${colors[color]} flex items-center justify-center text-2xl`}>
                        {icon}
                    </div>
                    <div>
                        <p className="text-2xl font-bold">{value}</p>
                        <p className="text-muted-foreground text-sm">{title}</p>
                        {subtitle && <p className="text-xs text-muted-foreground/70">{subtitle}</p>}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

function StatisticsPageContent() {
    const params = useParams();
    const quizId = Number(params.id);

    const [quiz, setQuiz] = useState<Quiz | null>(null);
    const [stats, setStats] = useState<QuizStatistics | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [quizData, statsData] = await Promise.all([
                    getQuiz(quizId),
                    getQuizStatistics(quizId),
                ]);
                setQuiz(quizData);
                setStats(statsData);
            } catch (err) {
                console.error('Failed to fetch statistics:', err);
                setError('Не удалось загрузить статистику');
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [quizId]);

    if (isLoading) {
        return (
            <div className="min-h-app">
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

    if (error || !stats) {
        return (
            <div className="min-h-app flex items-center justify-center">
                <Card className="max-w-md">
                    <CardContent className="pt-6 text-center">
                        <span className="text-5xl mb-4 block"></span>
                        <p className="text-muted-foreground mb-4">{error || 'Статистика недоступна'}</p>
                        <BackButton href={`/admin/quizzes/${quizId}`} label="Назад к викторине" />
                    </CardContent>
                </Card>
            </div>
        );
    }

    const { elimination_reasons: reasons } = stats;
    const totalReasons = reasons.timeout + reasons.wrong_answer + reasons.disconnected + reasons.other;

    return (
        <div className="min-h-app">
            {/* Header */}
            <header className="border-b border-border/50 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
                <div className="container max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <BackButton href={`/admin/quizzes/${quizId}`} label="Назад" variant="ghost" size="sm" />
                        <div>
                            <h1 className="font-bold">{quiz?.title ?? `Викторина #${quizId}`}</h1>
                            <p className="text-xs text-muted-foreground">Статистика</p>
                        </div>
                    </div>
                </div>
            </header>

            <main className="container max-w-5xl mx-auto px-4 py-8">
                <h2 className="text-2xl font-bold mb-6"> Расширенная статистика</h2>

                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
                    <StatCard
                        icon=""
                        title="Участников"
                        value={stats.total_participants}
                        color="primary"
                    />
                    <StatCard
                        icon=""
                        title="Победителей"
                        value={stats.total_winners}
                        color="green"
                    />
                    <StatCard
                        icon=""
                        title="Выбыло"
                        value={stats.total_eliminated}
                        color="red"
                    />
                    <StatCard
                        icon=""
                        title="Среднее время"
                        value={stats.avg_response_time_ms > 0 ? `${(stats.avg_response_time_ms / 1000).toFixed(1)}с` : '—'}
                        subtitle="на ответ"
                        color="yellow"
                    />
                    <StatCard
                        icon=""
                        title="Avg Pass Rate"
                        value={stats.avg_pass_rate > 0 ? `${(stats.avg_pass_rate * 100).toFixed(0)}%` : '—'}
                        subtitle="среднее прохождение"
                        color="primary"
                    />
                    <StatCard
                        icon=""
                        title="Из пула"
                        value={stats.pool_questions_used}
                        subtitle="вопросов"
                        color="primary"
                    />
                </div>

                {/* Elimination Reasons Pie */}
                <Card className="card-elevated border-0 rounded-2xl mb-8">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <span className="text-xl"></span>
                            Причины выбытия
                        </CardTitle>
                        <CardDescription>Распределение причин выбытия участников</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {totalReasons === 0 ? (
                            <p className="text-center text-muted-foreground py-8">Нет данных о выбытиях</p>
                        ) : (
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="text-center p-4 rounded-xl bg-orange-50">
                                    <p className="text-3xl font-bold text-orange-600">{reasons.timeout}</p>
                                    <p className="text-sm text-muted-foreground"> Таймаут</p>
                                    <p className="text-xs text-muted-foreground/70">
                                        {totalReasons > 0 ? `${((reasons.timeout / totalReasons) * 100).toFixed(0)}%` : '0%'}
                                    </p>
                                </div>
                                <div className="text-center p-4 rounded-xl bg-red-50">
                                    <p className="text-3xl font-bold text-red-600">{reasons.wrong_answer}</p>
                                    <p className="text-sm text-muted-foreground"> Неверный ответ</p>
                                    <p className="text-xs text-muted-foreground/70">
                                        {totalReasons > 0 ? `${((reasons.wrong_answer / totalReasons) * 100).toFixed(0)}%` : '0%'}
                                    </p>
                                </div>
                                <div className="text-center p-4 rounded-xl bg-gray-50">
                                    <p className="text-3xl font-bold text-gray-600">{reasons.disconnected}</p>
                                    <p className="text-sm text-muted-foreground"> Отключился</p>
                                    <p className="text-xs text-muted-foreground/70">
                                        {totalReasons > 0 ? `${((reasons.disconnected / totalReasons) * 100).toFixed(0)}%` : '0%'}
                                    </p>
                                </div>
                                <div className="text-center p-4 rounded-xl bg-purple-50">
                                    <p className="text-3xl font-bold text-purple-600">{reasons.other}</p>
                                    <p className="text-sm text-muted-foreground"> Другое</p>
                                    <p className="text-xs text-muted-foreground/70">
                                        {totalReasons > 0 ? `${((reasons.other / totalReasons) * 100).toFixed(0)}%` : '0%'}
                                    </p>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Difficulty Distribution - NEW */}
                <Card className="card-elevated border-0 rounded-2xl mb-8">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <span className="text-xl"></span>
                            Распределение сложности
                        </CardTitle>
                        <CardDescription>Сколько вопросов каждого уровня сложности</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-5 gap-3">
                            <div className="text-center p-4 rounded-xl bg-green-50">
                                <p className="text-3xl font-bold text-green-600">{stats.difficulty_distribution?.difficulty_1 || 0}</p>
                                <p className="text-sm text-muted-foreground"> Очень легко</p>
                            </div>
                            <div className="text-center p-4 rounded-xl bg-lime-50">
                                <p className="text-3xl font-bold text-lime-600">{stats.difficulty_distribution?.difficulty_2 || 0}</p>
                                <p className="text-sm text-muted-foreground"> Легко</p>
                            </div>
                            <div className="text-center p-4 rounded-xl bg-yellow-50">
                                <p className="text-3xl font-bold text-yellow-600">{stats.difficulty_distribution?.difficulty_3 || 0}</p>
                                <p className="text-sm text-muted-foreground"> Средне</p>
                            </div>
                            <div className="text-center p-4 rounded-xl bg-orange-50">
                                <p className="text-3xl font-bold text-orange-600">{stats.difficulty_distribution?.difficulty_4 || 0}</p>
                                <p className="text-sm text-muted-foreground"> Сложно</p>
                            </div>
                            <div className="text-center p-4 rounded-xl bg-red-50">
                                <p className="text-3xl font-bold text-red-600">{stats.difficulty_distribution?.difficulty_5 || 0}</p>
                                <p className="text-sm text-muted-foreground"> Очень сложно</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Eliminations by Question */}
                <Card className="card-elevated border-0 rounded-2xl">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <span className="text-xl"></span>
                            Выбытия по вопросам
                        </CardTitle>
                        <CardDescription>Количество выбывших на каждом вопросе</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {stats.eliminations_by_question.length === 0 ? (
                            <p className="text-center text-muted-foreground py-8">Нет данных о вопросах</p>
                        ) : (
                            <div className="space-y-3">
                                {stats.eliminations_by_question.map((q) => {
                                    const maxElim = Math.max(...stats.eliminations_by_question.map(e => e.eliminated_count), 1);
                                    const barWidth = (q.eliminated_count / maxElim) * 100;
                                    const difficultyColors: Record<number, string> = {
                                        1: 'bg-green-100 text-green-700',
                                        2: 'bg-lime-100 text-lime-700',
                                        3: 'bg-yellow-100 text-yellow-700',
                                        4: 'bg-orange-100 text-orange-700',
                                        5: 'bg-red-100 text-red-700',
                                    };

                                    return (
                                        <div key={q.question_id} className="flex items-center gap-4">
                                            <div className="w-24 text-sm font-medium flex items-center gap-2">
                                                Вопрос {q.question_number}
                                                <span className={`text-xs px-1.5 py-0.5 rounded ${difficultyColors[q.difficulty] || 'bg-gray-100'}`}>
                                                    {q.difficulty || '?'}
                                                </span>
                                            </div>
                                            <div className="flex-1 h-8 bg-secondary/30 rounded-full overflow-hidden relative">
                                                <div
                                                    className="h-full bg-gradient-to-r from-red-400 to-red-500 rounded-full transition-all"
                                                    style={{ width: `${barWidth}%` }}
                                                />
                                                <span className="absolute inset-0 flex items-center justify-center text-sm font-medium">
                                                    {q.eliminated_count} выбыло
                                                </span>
                                            </div>
                                            <div className="w-20 text-center">
                                                <span className={`text-sm font-medium ${q.pass_rate >= 0.7 ? 'text-green-600' : q.pass_rate >= 0.5 ? 'text-yellow-600' : 'text-red-600'}`}>
                                                    {q.pass_rate > 0 ? `${(q.pass_rate * 100).toFixed(0)}%` : '—'}
                                                </span>
                                                <p className="text-xs text-muted-foreground">pass rate</p>
                                            </div>
                                            <div className="w-28 text-right text-xs text-muted-foreground">
                                                <span className="text-orange-600"> {q.by_timeout}</span>
                                                {' / '}
                                                <span className="text-red-600"> {q.by_wrong_answer}</span>
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

export default function StatisticsPage() {
    return (
        <ProtectedRoute requireAdmin>
            <StatisticsPageContent />
        </ProtectedRoute>
    );
}
