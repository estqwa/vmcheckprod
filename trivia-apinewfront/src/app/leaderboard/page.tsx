'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/providers/AuthProvider';
import { getLeaderboard, LeaderboardEntry } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';

export default function LeaderboardPage() {
    const { isAuthenticated } = useAuth();
    const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const pageSize = 10;

    useEffect(() => {
        const fetchLeaderboard = async () => {
            setIsLoading(true);
            try {
                const data = await getLeaderboard({ page, page_size: pageSize });
                setEntries(data.users || []);
                setTotal(data.total || 0);
            } catch (error) {
                console.error('Failed to fetch leaderboard:', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchLeaderboard();
    }, [page]);

    const totalPages = Math.ceil(total / pageSize);

    const getRankStyle = (rank: number) => {
        if (rank === 1) return 'bg-yellow-50 border-yellow-300 shadow-yellow-100';
        if (rank === 2) return 'bg-gray-50 border-gray-300';
        if (rank === 3) return 'bg-orange-50 border-orange-300';
        return 'bg-white';
    };

    const getRankBadge = (rank: number) => {
        if (rank === 1) return '🥇';
        if (rank === 2) return '🥈';
        if (rank === 3) return '🥉';
        return `#${rank}`;
    };

    return (
        <div className="min-h-screen pb-24 md:pb-0">
            {/* Header */}
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
                            <Button variant="ghost" size="sm">🏠 Главная</Button>
                        </Link>
                        <Link href="/leaderboard">
                            <Button variant="ghost" size="sm" className="text-primary bg-primary/10">🏆 Рейтинг</Button>
                        </Link>
                        {isAuthenticated && (
                            <Link href="/profile">
                                <Button variant="ghost" size="sm">👤 Профиль</Button>
                            </Link>
                        )}
                    </nav>
                </div>
            </header>

            <main className="container max-w-3xl mx-auto px-4 py-8">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-3xl font-bold">Рейтинг игроков</h1>
                        <p className="text-muted-foreground">Лучшие игроки QazaQuiz</p>
                    </div>
                </div>

                <Card className="card-elevated border-0 rounded-2xl">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <span className="text-2xl">🏆</span>
                            Топ игроков
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? (
                            <div className="space-y-4">
                                {[...Array(5)].map((_, i) => (
                                    <Skeleton key={i} className="h-20 w-full rounded-xl" />
                                ))}
                            </div>
                        ) : entries.length === 0 ? (
                            <div className="text-center py-12">
                                <span className="text-5xl mb-4 block">🎮</span>
                                <p className="text-muted-foreground">Пока нет игроков. Будь первым!</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {entries.map((entry) => (
                                    <div
                                        key={entry.user_id}
                                        className={`flex items-center gap-4 p-4 rounded-xl border-2 transition-all ${getRankStyle(entry.rank)}`}
                                    >
                                        {/* Rank */}
                                        <div className="w-12 text-center flex-shrink-0">
                                            {entry.rank <= 3 ? (
                                                <span className="text-3xl">{getRankBadge(entry.rank)}</span>
                                            ) : (
                                                <span className="text-lg font-bold text-muted-foreground">{getRankBadge(entry.rank)}</span>
                                            )}
                                        </div>

                                        {/* Avatar & Name */}
                                        <Avatar className="h-12 w-12 border-2 border-white shadow-sm">
                                            <AvatarImage src={entry.profile_picture} />
                                            <AvatarFallback className="bg-primary/10 text-primary font-medium">
                                                {entry.username.substring(0, 2).toUpperCase()}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-semibold text-foreground truncate">{entry.username}</p>
                                            <p className="text-sm text-muted-foreground">{entry.wins_count} побед</p>
                                        </div>

                                        {/* Stats */}
                                        <div className="flex items-center gap-4">
                                            <div className="text-right">
                                                <p className="font-bold text-primary">{entry.wins_count}</p>
                                                <p className="text-xs text-muted-foreground">побед</p>
                                            </div>
                                            <div className="text-right min-w-[70px]">
                                                <p className="font-bold text-green-600">${entry.total_prize_won}</p>
                                                <p className="text-xs text-muted-foreground">выигрыш</p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Pagination */}
                        {totalPages > 1 && (
                            <div className="flex justify-center gap-2 mt-8">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={page === 1}
                                    onClick={() => setPage(p => p - 1)}
                                >
                                    ← Назад
                                </Button>
                                <span className="flex items-center px-4 text-sm text-muted-foreground">
                                    Страница {page} из {totalPages}
                                </span>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={page === totalPages}
                                    onClick={() => setPage(p => p + 1)}
                                >
                                    Вперёд →
                                </Button>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </main>

            {/* Mobile Navigation */}
            <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-border/50 py-2 px-4">
                <div className="flex justify-around">
                    <Link href="/" className="flex flex-col items-center text-muted-foreground">
                        <span className="text-xl">🏠</span>
                        <span className="text-xs">Главная</span>
                    </Link>
                    <Link href="/leaderboard" className="flex flex-col items-center text-primary">
                        <span className="text-xl">🏆</span>
                        <span className="text-xs">Рейтинг</span>
                    </Link>
                    {isAuthenticated ? (
                        <Link href="/profile" className="flex flex-col items-center text-muted-foreground">
                            <span className="text-xl">👤</span>
                            <span className="text-xs">Профиль</span>
                        </Link>
                    ) : (
                        <Link href="/login" className="flex flex-col items-center text-muted-foreground">
                            <span className="text-xl">🔑</span>
                            <span className="text-xs">Войти</span>
                        </Link>
                    )}
                </div>
            </div>
        </div>
    );
}
