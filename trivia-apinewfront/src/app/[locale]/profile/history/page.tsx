'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { useLocale } from '@/components/LanguageSwitcher';
import { formatCurrency } from '@/lib/formatCurrency';
import { StatusBadge } from '@/components/ui/status-badge';
import { SurfaceCard } from '@/components/ui/surface-card';
import { Trophy, XCircle, Clock, ChevronLeft, ChevronRight, History as HistoryIcon, Target } from 'lucide-react';
import { getMyGameHistory } from '@/lib/api/user';
import { QuizResult } from '@/lib/api/types';
import { formatDate } from '@/lib/formatDate';
import { PageHeader } from '@/components/PageHeader';
import { MobileBottomNav } from '@/components/MobileBottomNav';

export default function GameHistoryPage() {
    const t = useTranslations();
    const locale = useLocale();
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
                <StatusBadge tone="warning" icon={<Trophy className="w-3 h-3" />}>
                    {t('history.winner')}
                </StatusBadge>
            );
        }
        if (result.is_eliminated) {
            return (
                <StatusBadge tone="danger" icon={<XCircle className="w-3 h-3" />}>
                    {t('history.eliminated')}
                </StatusBadge>
            );
        }
        return (
            <StatusBadge tone="neutral" icon={<Clock className="w-3 h-3" />}>
                {t('history.finished')}
            </StatusBadge>
        );
    };

    return (
        <ProtectedRoute>
            <div className="min-h-app mobile-nav-safe-area">
                <PageHeader active='profile' />

                {/* Content */}
                <main className="container max-w-4xl mx-auto px-4 py-8">
                    {/* Breadcrumb */}
                    <div className="mb-6">
                        <Link href="/profile" className="text-muted-foreground hover:text-primary transition-colors inline-flex items-center gap-1">
                            <ChevronLeft className="w-4 h-4" />
                            {t('history.backToProfile')}
                        </Link>
                    </div>

                    <h1 className="text-3xl font-bold mb-8 inline-flex items-center gap-2">
                        <HistoryIcon className="w-7 h-7 text-primary" />
                        {t('history.title')}
                    </h1>

                    <SurfaceCard className="card-elevated border-0 rounded-2xl">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <HistoryIcon className="w-5 h-5 text-primary" />
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
                                <EmptyState
                                    icon={<Target className="w-10 h-10" />}
                                    title={t('history.noGames')}
                                    action={(
                                        <Button asChild className="btn-coral">
                                            <Link href="/">
                                                {t('history.playNow')}
                                            </Link>
                                        </Button>
                                    )}
                                />
                            ) : (
                                <div className="space-y-3">
                                    {results.map((result) => (
                                        <SurfaceCard
                                            key={result.id}
                                            tone="muted"
                                            className="flex items-center justify-between gap-4 p-4 shadow-none transition-colors hover:bg-secondary/50"
                                        >
                                            <div className="flex-1">
                                                <div className="flex items-center gap-3 mb-2">
                                                    {getStatusBadge(result)}
                                                    <span className="text-muted-foreground text-sm">
                                                        {formatDate(result.completed_at, locale)}
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
                                                        <span className="text-success font-semibold inline-flex items-center gap-1">
                                                            <Trophy className="w-4 h-4" />
                                                            {formatCurrency(result.prize_fund)}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <Button asChild variant="outline" size="sm">
                                                <Link href={`/quiz/${result.quiz_id}/results`}>
                                                    {t('history.viewResults')}
                                                </Link>
                                            </Button>
                                        </SurfaceCard>
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
                    </SurfaceCard>
                </main>
                <MobileBottomNav active="profile" />
            </div>
        </ProtectedRoute>
    );
}


