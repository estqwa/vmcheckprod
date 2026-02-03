'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { Trophy, XCircle, Clock, ChevronLeft, ChevronRight } from 'lucide-react';
import { getMyGameHistory } from '@/lib/api/user';
import { QuizResult } from '@/lib/api/types';

export default function GameHistoryPage() {
    const t = useTranslations();
    const tNav = useTranslations('nav');
    const [results, setResults] = useState<QuizResult[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const pageSize = 10;

    useEffect(() => {
        async function fetchHistory() {
            try {
                setLoading(true);
                const data = await getMyGameHistory({ page, page_size: pageSize });
                setResults(data.results);
                setTotalPages(Math.ceil(data.total / pageSize));
            } catch (error) {
                console.error('Failed to fetch game history:', error);
            } finally {
                setLoading(false);
            }
        }

        fetchHistory();
    }, [page]);

    const getStatusBadge = (result: QuizResult) => {
        if (result.is_winner) {
            return (
                <Badge className="bg-gradient-to-r from-yellow-400 to-amber-400 text-yellow-900 border-0">
                    <Trophy className="w-3 h-3 mr-1" />
                    {t('history.winner')}
                </Badge>
            );
        }
        if (result.is_eliminated) {
            return (
                <Badge variant="destructive" className="bg-red-100 text-red-700 border-0">
                    <XCircle className="w-3 h-3 mr-1" />
                    {t('history.eliminated')}
                </Badge>
            );
        }
        return (
            <Badge variant="secondary" className="bg-gray-100 text-gray-700 border-0">
                <Clock className="w-3 h-3 mr-1" />
                {t('history.finished')}
            </Badge>
        );
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('ru-RU', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    return (
        <ProtectedRoute>
            <div className="min-h-screen pb-24 md:pb-0">
                {/* Header - совпадает с profile */}
                <header className="border-b border-border/50 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
                    <div className="container max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
                        <Link href="/" className="flex items-center gap-2">
                            <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
                                <span className="text-white font-bold text-lg">Q</span>
                            </div>
                            <span className="font-bold text-xl text-foreground">QazaQuiz</span>
                        </Link>
                        <nav className="hidden md:flex items-center gap-1">
                            <Link href="/">
                                <Button variant="ghost" size="sm">🏠 {tNav('home')}</Button>
                            </Link>
                            <Link href="/leaderboard">
                                <Button variant="ghost" size="sm">🏆 {tNav('leaderboard')}</Button>
                            </Link>
                            <Link href="/profile">
                                <Button variant="ghost" size="sm" className="text-primary bg-primary/10">👤 {tNav('profile')}</Button>
                            </Link>
                        </nav>
                        <LanguageSwitcher />
                    </div>
                </header>

                {/* Content */}
                <main className="container max-w-4xl mx-auto px-4 py-8">
                    {/* Breadcrumb */}
                    <div className="mb-6">
                        <Link href="/profile" className="text-muted-foreground hover:text-primary transition-colors">
                            ← {t('history.backToProfile')}
                        </Link>
                    </div>

                    <h1 className="text-3xl font-bold mb-8">📜 {t('history.title')}</h1>

                    <Card className="card-elevated border-0 rounded-2xl">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <span className="text-xl">🎮</span>
                                {t('history.title')}
                            </CardTitle>
                            <CardDescription>
                                {t('history.description')}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {loading ? (
                                <div className="space-y-4">
                                    {[...Array(5)].map((_, i) => (
                                        <Skeleton key={i} className="h-20 w-full rounded-xl" />
                                    ))}
                                </div>
                            ) : results.length === 0 ? (
                                <div className="text-center py-12">
                                    <div className="text-4xl mb-4">🎯</div>
                                    <p className="text-muted-foreground mb-4">{t('history.noGames')}</p>
                                    <Link href="/">
                                        <Button className="btn-coral">
                                            {t('history.playNow')}
                                        </Button>
                                    </Link>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {results.map((result) => (
                                        <div
                                            key={result.id}
                                            className="flex items-center justify-between p-4 rounded-xl bg-secondary/30 hover:bg-secondary/50 transition-colors"
                                        >
                                            <div className="flex-1">
                                                <div className="flex items-center gap-3 mb-2">
                                                    {getStatusBadge(result)}
                                                    <span className="text-muted-foreground text-sm">
                                                        {formatDate(result.completed_at)}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                                    <span>
                                                        {t('history.score')}: <strong className="text-foreground">{result.score}</strong>
                                                    </span>
                                                    <span>
                                                        {t('history.correct')}: <strong className="text-foreground">{result.correct_answers}/{result.total_questions}</strong>
                                                    </span>
                                                    {result.rank > 0 && (
                                                        <span>
                                                            {t('history.rank')}: <strong className="text-foreground">#{result.rank}</strong>
                                                        </span>
                                                    )}
                                                    {result.is_winner && result.prize_fund > 0 && (
                                                        <span className="text-green-600 font-semibold">
                                                            🎉 {result.prize_fund.toLocaleString()} ₸
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <Link href={`/quiz/${result.quiz_id}/results`}>
                                                <Button variant="outline" size="sm">
                                                    {t('history.viewResults')}
                                                </Button>
                                            </Link>
                                        </div>
                                    ))}

                                    {/* Pagination */}
                                    {totalPages > 1 && (
                                        <div className="flex items-center justify-center gap-2 pt-6 border-t">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setPage((p) => Math.max(1, p - 1))}
                                                disabled={page === 1}
                                            >
                                                <ChevronLeft className="w-4 h-4" />
                                                {t('history.prev')}
                                            </Button>
                                            <span className="px-4 py-2 text-sm text-muted-foreground">
                                                {t('history.page')} {page} / {totalPages}
                                            </span>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setPage((p) => p + 1)}
                                                disabled={page >= totalPages}
                                            >
                                                {t('history.next')}
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
        </ProtectedRoute>
    );
}
