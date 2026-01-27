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

const statusColors: Record<string, string> = {
    scheduled: 'bg-blue-500',
    in_progress: 'bg-green-500',
    completed: 'bg-gray-500',
    cancelled: 'bg-red-500',
};

function AdminDashboard() {
    const router = useRouter();
    const [quizzes, setQuizzes] = useState<Quiz[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchQuizzes = async () => {
            try {
                const data = await getQuizzes({ page: 1, page_size: 50 });
                // Sort by scheduled_time descending (newest first)
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
        return new Date(dateStr).toLocaleString();
    };

    return (
        <main className="container max-w-5xl mx-auto px-4 py-12">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold">Admin Dashboard</h1>
                    <p className="text-muted-foreground">Manage your trivia quizzes</p>
                </div>
                <div className="flex gap-2">
                    <Link href="/">
                        <Button variant="ghost">← Back to App</Button>
                    </Link>
                    <Link href="/admin/ads">
                        <Button variant="outline">📺 Реклама</Button>
                    </Link>
                    <Link href="/admin/quizzes/new">
                        <Button>+ Create Quiz</Button>
                    </Link>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>All Quizzes</CardTitle>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="space-y-3">
                            {[...Array(5)].map((_, i) => (
                                <Skeleton key={i} className="h-20 w-full" />
                            ))}
                        </div>
                    ) : quizzes.length === 0 ? (
                        <div className="text-center py-12">
                            <p className="text-muted-foreground mb-4">No quizzes yet</p>
                            <Link href="/admin/quizzes/new">
                                <Button>Create your first quiz</Button>
                            </Link>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {quizzes.map((quiz) => (
                                <div
                                    key={quiz.id}
                                    className="flex items-center gap-4 p-4 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors"
                                    onClick={() => router.push(`/admin/quizzes/${quiz.id}`)}
                                >
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <h3 className="font-semibold">{quiz.title}</h3>
                                            <Badge className={statusColors[quiz.status]}>{quiz.status}</Badge>
                                        </div>
                                        <p className="text-sm text-muted-foreground">
                                            {quiz.question_count} questions • Scheduled: {formatDate(quiz.scheduled_time)}
                                        </p>
                                        {quiz.description && (
                                            <p className="text-sm text-muted-foreground mt-1 line-clamp-1">{quiz.description}</p>
                                        )}
                                    </div>
                                    <Button variant="ghost" size="sm">
                                        View →
                                    </Button>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </main>
    );
}

export default function AdminPage() {
    return (
        <ProtectedRoute requireAdmin>
            <AdminDashboard />
        </ProtectedRoute>
    );
}
