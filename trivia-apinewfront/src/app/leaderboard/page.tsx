'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getLeaderboard, LeaderboardEntry } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

export default function LeaderboardPage() {
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
        if (rank === 1) return 'bg-yellow-500/20 text-yellow-500 border-yellow-500/50';
        if (rank === 2) return 'bg-gray-400/20 text-gray-400 border-gray-400/50';
        if (rank === 3) return 'bg-orange-500/20 text-orange-500 border-orange-500/50';
        return '';
    };

    return (
        <main className="container max-w-3xl mx-auto px-4 py-12">
            <div className="flex items-center justify-between mb-8">
                <h1 className="text-3xl font-bold">Leaderboard</h1>
                <Link href="/">
                    <Button variant="ghost">← Back</Button>
                </Link>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Top Players</CardTitle>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="space-y-4">
                            {[...Array(5)].map((_, i) => (
                                <Skeleton key={i} className="h-16 w-full" />
                            ))}
                        </div>
                    ) : entries.length === 0 ? (
                        <p className="text-muted-foreground text-center py-8">No players yet. Be the first!</p>
                    ) : (
                        <div className="space-y-3">
                            {entries.map((entry) => (
                                <div
                                    key={entry.user_id}
                                    className={`flex items-center gap-4 p-4 rounded-lg border ${getRankStyle(entry.rank)}`}
                                >
                                    {/* Rank */}
                                    <div className="w-10 text-center">
                                        {entry.rank <= 3 ? (
                                            <span className="text-2xl">
                                                {entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : '🥉'}
                                            </span>
                                        ) : (
                                            <span className="text-lg font-bold text-muted-foreground">#{entry.rank}</span>
                                        )}
                                    </div>

                                    {/* Avatar & Name */}
                                    <Avatar>
                                        <AvatarImage src={entry.profile_picture} />
                                        <AvatarFallback>
                                            {entry.username.substring(0, 2).toUpperCase()}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1">
                                        <p className="font-semibold">{entry.username}</p>
                                    </div>

                                    {/* Stats */}
                                    <div className="flex items-center gap-4 text-right">
                                        <div>
                                            <p className="font-bold">{entry.wins_count}</p>
                                            <p className="text-xs text-muted-foreground">Wins</p>
                                        </div>
                                        <div>
                                            <Badge variant="secondary" className="text-green-500">
                                                ${entry.total_prize_won}
                                            </Badge>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="flex justify-center gap-2 mt-6">
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={page === 1}
                                onClick={() => setPage(p => p - 1)}
                            >
                                Previous
                            </Button>
                            <span className="flex items-center px-4 text-sm text-muted-foreground">
                                Page {page} of {totalPages}
                            </span>
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={page === totalPages}
                                onClick={() => setPage(p => p + 1)}
                            >
                                Next
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>
        </main>
    );
}
