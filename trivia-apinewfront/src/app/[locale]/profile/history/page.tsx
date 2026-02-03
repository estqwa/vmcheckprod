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
import { ArrowLeft, Trophy, XCircle, Clock, ChevronLeft, ChevronRight } from 'lucide-react';
import { getMyGameHistory } from '@/lib/api/user';
import { QuizResult } from '@/lib/api/types';

export default function GameHistoryPage() {
    const t = useTranslations();
    const [results, setResults] = useState<QuizResult[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const pageSize = 10;

    useEffect(() => {
        async function fetchHistory() {
            try {
                setLoading(true);
                const data = await getMyGameHistory({ page, page_size: pageSize });
                setResults(data.results);
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
                <Badge className="bg-gradient-to-r from-yellow-500 to-amber-500 text-white">
                    <Trophy className="w-3 h-3 mr-1" />
                    {t('history.winner')}
                </Badge>
            );
        }
        if (result.is_eliminated) {
            return (
                <Badge variant="destructive">
                    <XCircle className="w-3 h-3 mr-1" />
                    {t('history.eliminated')}
                </Badge>
            );
        }
        return (
            <Badge variant="secondary">
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
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
                <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center opacity-10" />

                {/* Header */}
                <header className="relative z-10 border-b border-white/10 bg-black/20 backdrop-blur-sm">
                    <div className="container mx-auto px-4 py-4 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Link href="/profile">
                                <Button variant="ghost" size="icon" className="text-white/70 hover:text-white">
                                    <ArrowLeft className="w-5 h-5" />
                                </Button>
                            </Link>
                            <h1 className="text-xl font-bold text-white">{t('history.title')}</h1>
                        </div>
                        <LanguageSwitcher />
                    </div>
                </header>

                {/* Content */}
                <main className="relative z-10 container mx-auto px-4 py-8">
                    <Card className="border-0 bg-white/5 backdrop-blur-sm">
                        <CardHeader>
                            <CardTitle className="text-white">{t('history.title')}</CardTitle>
                            <CardDescription className="text-white/60">
                                {t('history.description')}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {loading ? (
                                <div className="space-y-4">
                                    {[...Array(5)].map((_, i) => (
                                        <Skeleton key={i} className="h-20 w-full bg-white/10" />
                                    ))}
                                </div>
                            ) : results.length === 0 ? (
                                <div className="text-center py-12">
                                    <p className="text-white/60">{t('history.noGames')}</p>
                                    <Link href="/">
                                        <Button className="mt-4" variant="outline">
                                            {t('history.playNow')}
                                        </Button>
                                    </Link>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {results.map((result) => (
                                        <div
                                            key={result.id}
                                            className="flex items-center justify-between p-4 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                                        >
                                            <div className="flex-1">
                                                <div className="flex items-center gap-3 mb-2">
                                                    {getStatusBadge(result)}
                                                    <span className="text-white/50 text-sm">
                                                        {formatDate(result.completed_at)}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-4 text-sm text-white/70">
                                                    <span>
                                                        {t('history.score')}: <strong className="text-white">{result.score}</strong>
                                                    </span>
                                                    <span>
                                                        {t('history.correct')}: <strong className="text-white">{result.correct_answers}/{result.total_questions}</strong>
                                                    </span>
                                                    {result.rank > 0 && (
                                                        <span>
                                                            {t('history.rank')}: <strong className="text-white">#{result.rank}</strong>
                                                        </span>
                                                    )}
                                                    {result.is_winner && result.prize_fund > 0 && (
                                                        <span className="text-yellow-400">
                                                            {t('history.prize')}: <strong>{result.prize_fund.toLocaleString()} ₸</strong>
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <Link href={`/quiz/${result.quiz_id}/results`}>
                                                <Button variant="ghost" size="sm" className="text-white/70">
                                                    {t('history.viewResults')}
                                                </Button>
                                            </Link>
                                        </div>
                                    ))}

                                    {/* Pagination */}
                                    <div className="flex justify-center gap-2 pt-4">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                                            disabled={page === 1}
                                        >
                                            <ChevronLeft className="w-4 h-4" />
                                        </Button>
                                        <span className="px-4 py-2 text-white/70">
                                            {t('history.page')} {page}
                                        </span>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setPage((p) => p + 1)}
                                            disabled={results.length < pageSize}
                                        >
                                            <ChevronRight className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </main>
            </div>
        </ProtectedRoute>
    );
}
