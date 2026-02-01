'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getQuizzes, Quiz } from '@/lib/api';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

const statusColors: Record<string, { bg: string; text: string; label: string }> = {
    scheduled: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Запланирована' },
    in_progress: { bg: 'bg-green-100', text: 'text-green-700', label: 'Идёт' },
    completed: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Завершена' },
    cancelled: { bg: 'bg-red-100', text: 'text-red-700', label: 'Отменена' },
};

function AdminDashboard() {
    const router = useRouter();
    const [quizzes, setQuizzes] = useState<Quiz[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchQuizzes = async () => {
            try {
                const data = await getQuizzes({ page: 1, page_size: 50 });
                const sorted = data.sort((a, b) =>
                    new Date(b.scheduled_time).getTime() - new Date(a.scheduled_time).getTime()
                );
                setQuizzes(sorted);
            } catch (error) {
                console.error('Failed to fetch quizzes:', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchQuizzes();
    }, []);

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleString('ru-RU');
    };

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
                    <div className="flex gap-2">
                        <Link href="/">
                            <Button variant="ghost" size="sm">← К приложению</Button>
                        </Link>
                    </div>
                </div>
            </header>

            <main className="container max-w-5xl mx-auto px-4 py-8">
                {/* Title + Actions */}
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-3xl font-bold">Админ-панель</h1>
                        <p className="text-muted-foreground">Управление викторинами</p>
                    </div>
                    <div className="flex gap-2">
                        <Link href="/admin/monitoring">
                            <Button variant="outline">📊 Мониторинг</Button>
                        </Link>
                        <Link href="/admin/ads">
                            <Button variant="outline">📺 Реклама</Button>
                        </Link>
                        <Link href="/admin/quizzes/new">
                            <Button className="btn-coral">+ Создать викторину</Button>
                        </Link>
                    </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                    <Card className="card-elevated border-0 rounded-xl">
                        <CardContent className="pt-6 text-center">
                            <p className="text-3xl font-bold">{quizzes.length}</p>
                            <p className="text-muted-foreground text-sm">Всего викторин</p>
                        </CardContent>
                    </Card>
                    <Card className="card-elevated border-0 rounded-xl">
                        <CardContent className="pt-6 text-center">
                            <p className="text-3xl font-bold text-blue-600">
                                {quizzes.filter(q => q.status === 'scheduled').length}
                            </p>
                            <p className="text-muted-foreground text-sm">Запланировано</p>
                        </CardContent>
                    </Card>
                    <Card className="card-elevated border-0 rounded-xl">
                        <CardContent className="pt-6 text-center">
                            <p className="text-3xl font-bold text-green-600">
                                {quizzes.filter(q => q.status === 'in_progress').length}
                            </p>
                            <p className="text-muted-foreground text-sm">Активных</p>
                        </CardContent>
                    </Card>
                    <Card className="card-elevated border-0 rounded-xl">
                        <CardContent className="pt-6 text-center">
                            <p className="text-3xl font-bold text-gray-600">
                                {quizzes.filter(q => q.status === 'completed').length}
                            </p>
                            <p className="text-muted-foreground text-sm">Завершено</p>
                        </CardContent>
                    </Card>
                </div>

                {/* Quizzes List */}
                <Card className="card-elevated border-0 rounded-2xl">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <span className="text-xl">📋</span>
                            Все викторины
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? (
                            <div className="space-y-3">
                                {[...Array(5)].map((_, i) => (
                                    <Skeleton key={i} className="h-20 w-full rounded-xl" />
                                ))}
                            </div>
                        ) : quizzes.length === 0 ? (
                            <div className="text-center py-12">
                                <span className="text-5xl mb-4 block">🎮</span>
                                <p className="text-muted-foreground mb-4">Викторин пока нет</p>
                                <Link href="/admin/quizzes/new">
                                    <Button className="btn-coral">Создать первую викторину</Button>
                                </Link>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {quizzes.map((quiz) => {
                                    const status = statusColors[quiz.status] || statusColors.scheduled;
                                    return (
                                        <div
                                            key={quiz.id}
                                            className="flex items-center gap-4 p-4 rounded-xl bg-secondary/30 hover:bg-secondary/50 cursor-pointer transition-all"
                                            onClick={() => router.push(`/admin/quizzes/${quiz.id}`)}
                                        >
                                            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                                                <span className="text-2xl">🎯</span>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <h3 className="font-semibold truncate">{quiz.title}</h3>
                                                    <Badge className={`${status.bg} ${status.text} border-0`}>
                                                        {status.label}
                                                    </Badge>
                                                </div>
                                                <p className="text-sm text-muted-foreground">
                                                    {quiz.question_count} вопросов • {formatDate(quiz.scheduled_time)}
                                                </p>
                                                {quiz.description && (
                                                    <p className="text-sm text-muted-foreground mt-1 line-clamp-1">{quiz.description}</p>
                                                )}
                                            </div>
                                            <Button variant="ghost" size="sm">
                                                Открыть →
                                            </Button>
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

export default function AdminPage() {
    return (
        <ProtectedRoute requireAdmin>
            <AdminDashboard />
        </ProtectedRoute>
    );
}
