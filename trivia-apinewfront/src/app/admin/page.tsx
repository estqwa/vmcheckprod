'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getQuizzes, PaginatedQuizzesResponse } from '@/lib/api';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { Button } from '@/components/ui/button';
import { BackButton } from '@/components/BackButton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { formatDate } from '@/lib/formatDate';

const PAGE_SIZE = 20;

const statusTabs = [
    { value: '', label: 'Все' },
    { value: 'scheduled', label: 'Запланированные' },
    { value: 'in_progress', label: 'Активные' },
    { value: 'completed', label: 'Завершённые' },
    { value: 'cancelled', label: 'Отменённые' },
] as const;

const statusColors: Record<string, { bg: string; text: string; label: string }> = {
    scheduled: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Запланирована' },
    in_progress: { bg: 'bg-green-100', text: 'text-green-700', label: 'Идёт' },
    completed: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Завершена' },
    cancelled: { bg: 'bg-red-100', text: 'text-red-700', label: 'Отменена' },
};

function AdminDashboard() {
    const router = useRouter();
    const [data, setData] = useState<PaginatedQuizzesResponse | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [currentPage, setCurrentPage] = useState(1);

    const fetchQuizzes = useCallback(async (page: number, status: string, search: string) => {
        try {
            setIsLoading(true);
            const result = await getQuizzes({
                page,
                page_size: PAGE_SIZE,
                status,
                search: search || undefined,
            });
            setData(result);
        } catch (error) {
            console.error('Failed to fetch quizzes:', error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchQuizzes(currentPage, statusFilter, searchQuery);
    }, [currentPage, statusFilter, fetchQuizzes]); // searchQuery excluded — server search on Enter/blur

    const handleSearchSubmit = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            setCurrentPage(1);
            fetchQuizzes(1, statusFilter, searchQuery);
        }
    };

    const handleStatusChange = (newStatus: string) => {
        setStatusFilter(newStatus);
        setCurrentPage(1);
    };

    const quizzes = data?.quizzes ?? [];
    const totalItems = data?.total ?? 0;
    const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));

    return (
        <div className="min-h-app">
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
                        <BackButton href="/" label="К приложению" variant="ghost" size="sm" />
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
                        <Button asChild variant="outline">
                            <Link href="/admin/monitoring"> Мониторинг</Link>
                        </Button>
                        <Button asChild variant="outline">
                            <Link href="/admin/ads"> Реклама</Link>
                        </Button>
                        <Button asChild variant="outline">
                            <Link href="/admin/question-pool"> Пул вопросов</Link>
                        </Button>
                        <Button asChild className="btn-coral">
                            <Link href="/admin/quizzes/new">+ Создать викторину</Link>
                        </Button>
                    </div>
                </div>

                {/* Stats - from total count */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                    <Card className="card-elevated border-0 rounded-xl">
                        <CardContent className="pt-6 text-center">
                            <p className="text-3xl font-bold">{totalItems}</p>
                            <p className="text-muted-foreground text-sm">
                                {statusFilter ? statusTabs.find(t => t.value === statusFilter)?.label : 'Всего викторин'}
                            </p>
                        </CardContent>
                    </Card>
                </div>

                {/* Quizzes List */}
                <Card className="card-elevated border-0 rounded-2xl">
                    <CardHeader>
                        <div className="flex flex-col gap-4">
                            <CardTitle className="flex items-center gap-2">
                                <span className="text-xl"></span>
                                Викторины
                            </CardTitle>

                            {/* Status Tabs */}
                            <div className="flex flex-wrap gap-1">
                                {statusTabs.map((tab) => (
                                    <button
                                        key={tab.value}
                                        onClick={() => handleStatusChange(tab.value)}
                                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${statusFilter === tab.value
                                            ? 'bg-primary text-white'
                                            : 'bg-secondary/50 text-muted-foreground hover:bg-secondary'
                                            }`}
                                    >
                                        {tab.label}
                                    </button>
                                ))}
                            </div>

                            {/* Search */}
                            <Input
                                placeholder=" Поиск по названию... (Enter)"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onKeyDown={handleSearchSubmit}
                                className="w-full sm:w-64"
                            />
                        </div>
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
                                <span className="text-5xl mb-4 block"></span>
                                <p className="text-muted-foreground mb-4">
                                    {totalItems === 0 ? 'Викторин пока нет' : 'Ничего не найдено'}
                                </p>
                                {totalItems === 0 && !statusFilter && (
                                    <Button asChild className="btn-coral">
                                        <Link href="/admin/quizzes/new">Создать первую викторину</Link>
                                    </Button>
                                )}
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
                                                <span className="text-2xl"></span>
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

                                {/* Pagination */}
                                {totalPages > 1 && (
                                    <div className="flex items-center justify-center gap-2 pt-4 border-t">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            disabled={currentPage === 1}
                                            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                                        >
                                            <ChevronLeft className="w-4 h-4" />
                                            Назад
                                        </Button>
                                        <span className="px-4 py-2 text-sm text-muted-foreground">
                                            Страница {currentPage} из {totalPages} ({totalItems} викторин)
                                        </span>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            disabled={currentPage >= totalPages}
                                            onClick={() => setCurrentPage((p) => p + 1)}
                                        >
                                            Вперёд
                                            <ChevronRight className="w-4 h-4" />
                                        </Button>
                                    </div>
                                )}
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
