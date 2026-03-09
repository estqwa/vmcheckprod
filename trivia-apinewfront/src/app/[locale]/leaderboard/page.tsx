'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { getLeaderboard } from '@/lib/api';
import { leaderboardQueryKey } from '@/lib/hooks/useUserQuery';
import { Button } from '@/components/ui/button';
import { useLocale } from '@/components/LanguageSwitcher';
import { formatCurrency } from '@/lib/formatCurrency';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { MobileBottomNav } from '@/components/MobileBottomNav';
import { Award, ChevronLeft, ChevronRight, Gamepad2, Medal, Trophy } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';

export default function LeaderboardPage() {
    const [page, setPage] = useState(1);
    const pageSize = 10;

    const locale = useLocale();
    const t = useTranslations('leaderboard');
    const tCommon = useTranslations('common');

    const { data, isLoading } = useQuery({
        queryKey: [...leaderboardQueryKey, page],
        queryFn: () => getLeaderboard({ page, page_size: pageSize }),
        staleTime: 30 * 1000,
    });

    const entries = data?.users ?? [];
    const total = data?.total ?? 0;
    const totalPages = Math.ceil(total / pageSize);

    const getRankStyle = (rank: number) => {
        if (rank === 1) return 'bg-yellow-50 border-yellow-300 shadow-yellow-100';
        if (rank === 2) return 'bg-gray-50 border-gray-300';
        if (rank === 3) return 'bg-orange-50 border-orange-300';
        return 'bg-white';
    };

    const getRankBadge = (rank: number): React.ReactNode => {
        if (rank === 1) return <Trophy className="w-7 h-7 text-yellow-800" />;
        if (rank === 2) return <Medal className="w-7 h-7 text-slate-500" />;
        if (rank === 3) return <Award className="w-7 h-7 text-amber-700" />;
        return <span className="text-lg font-bold text-muted-foreground">#{rank}</span>;
    };

    return (
        <div className="min-h-app mobile-nav-safe-area">
            <PageHeader active="leaderboard" />

            <main className="container max-w-3xl mx-auto px-4 py-8">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold">{t('title')}</h1>
                    <p className="text-muted-foreground">{t('subtitle') || 'Best QazaQuiz players'}</p>
                </div>

                <Card className="card-elevated border-0 rounded-2xl">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Trophy className="w-6 h-6 text-primary" />
                            {t('topPlayers') || 'Top players'}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? (
                            <div className="space-y-4">
                                {[...Array(5)].map((_, i) => (
                                    <Skeleton key={i} className="h-24 w-full rounded-xl" />
                                ))}
                            </div>
                        ) : entries.length === 0 ? (
                            <div className="text-center py-12">
                                <Gamepad2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                                <p className="text-muted-foreground">{t('noPlayers') || 'No players yet'}</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {entries.map((entry) => (
                                    <div
                                        key={entry.user_id}
                                        className={`rounded-xl border-2 p-4 transition-all ${getRankStyle(entry.rank)}`}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="flex w-12 flex-shrink-0 items-center justify-center text-center">
                                                {getRankBadge(entry.rank)}
                                            </div>

                                            <Avatar className="h-12 w-12 border-2 border-white shadow-sm">
                                                <AvatarImage src={entry.profile_picture} />
                                                <AvatarFallback className="bg-primary/10 text-primary font-medium">
                                                    {entry.username.substring(0, 2).toUpperCase()}
                                                </AvatarFallback>
                                            </Avatar>

                                            <div className="min-w-0 flex-1">
                                                <p className="truncate font-semibold text-foreground">{entry.username}</p>
                                                <p className="text-sm text-muted-foreground">#{entry.rank}</p>
                                            </div>
                                        </div>

                                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                                            <div className="rounded-xl bg-secondary/50 px-3 py-2">
                                                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('wins')}</p>
                                                <p className="mt-1 text-lg font-bold text-primary">{entry.wins_count}</p>
                                            </div>
                                            <div className="rounded-xl bg-green-50 px-3 py-2">
                                                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('prize')}</p>
                                                <p className="mt-1 text-lg font-bold text-success break-words">{formatCurrency(entry.total_prize_won, locale)}</p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {totalPages > 1 ? (
                            <div className="mt-8 flex justify-center gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={page === 1}
                                    onClick={() => setPage((p) => p - 1)}
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                    {tCommon('back')}
                                </Button>
                                <span className="flex items-center px-4 text-sm text-muted-foreground">
                                    {page} / {totalPages}
                                </span>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    aria-label="Next page"
                                    disabled={page === totalPages}
                                    onClick={() => setPage((p) => p + 1)}
                                >
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                            </div>
                        ) : null}
                    </CardContent>
                </Card>
            </main>

            <MobileBottomNav active="leaderboard" />
        </div>
    );
}
