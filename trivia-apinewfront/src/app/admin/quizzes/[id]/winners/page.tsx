'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { getQuizResults, getQuiz, Quiz, QuizResult } from '@/lib/api';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { toast } from 'sonner';
import { Trophy, ArrowLeft, Medal } from 'lucide-react';

function WinnersPageContent() {
    const params = useParams();
    const quizId = Number(params.id);

    const [quiz, setQuiz] = useState<Quiz | null>(null);
    const [winners, setWinners] = useState<QuizResult[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                // Fetch quiz info and results in parallel
                const [quizData, resultsData] = await Promise.all([
                    getQuiz(quizId),
                    getQuizResults(quizId, { page: 1, page_size: 100 })
                ]);

                setQuiz(quizData);

                // Filter for winners only
                const winnersList = resultsData.results.filter(r => r.is_winner);
                setWinners(winnersList);
            } catch (error) {
                console.error('Failed to fetch winners data:', error);
                toast.error('Failed to load winners data');
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [quizId]);

    const getRankIcon = (rank: number) => {
        switch (rank) {
            case 1: return <Trophy className="h-6 w-6 text-yellow-500" />;
            case 2: return <Medal className="h-6 w-6 text-gray-400" />;
            case 3: return <Medal className="h-6 w-6 text-amber-600" />;
            default: return <span className="font-bold text-muted-foreground">#{rank}</span>;
        }
    };

    if (isLoading) {
        return (
            <main className="container max-w-4xl mx-auto px-4 py-12">
                <Skeleton className="h-8 w-48 mb-8" />
                <Skeleton className="h-64 w-full" />
            </main>
        );
    }

    if (!quiz) return <div className="p-8 text-center">Quiz not found</div>;

    const totalPrizePool = winners.reduce((sum, w) => sum + (w.prize_fund || 0), 0);

    return (
        <main className="container max-w-4xl mx-auto px-4 py-12">
            <div className="flex items-center gap-4 mb-8">
                <Link href={`/admin/quizzes/${quizId}`}>
                    <Button variant="ghost" size="icon">
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                </Link>
                <div>
                    <h1 className="text-3xl font-bold flex items-center gap-2">
                        Winners: {quiz.title}
                    </h1>
                    <p className="text-muted-foreground">
                        Executed on {new Date(quiz.scheduled_time).toLocaleDateString()}
                    </p>
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-3 mb-8">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Total Winners</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{winners.length}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Total Prize Pool</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">${totalPrizePool}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Status</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Badge className="bg-gray-500">Completed</Badge>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Winner List & Prizes</CardTitle>
                    <CardDescription>
                        Participants who answered all questions correctly and shared the prize pool.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {winners.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                            No winners found for this quiz yet.
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {winners.map((winner) => (
                                <div
                                    key={winner.id}
                                    className="flex items-center justify-between p-4 border rounded-lg bg-card hover:bg-accent/50 transition-colors"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="flex-shrink-0 w-8 flex justify-center">
                                            {getRankIcon(winner.rank)}
                                        </div>
                                        <Avatar className="h-10 w-10 border">
                                            <AvatarImage src={winner.profile_picture} />
                                            <AvatarFallback>{winner.username.substring(0, 2).toUpperCase()}</AvatarFallback>
                                        </Avatar>
                                        <div>
                                            <div className="font-semibold">{winner.username}</div>
                                            <div className="text-sm text-muted-foreground">
                                                Score: {winner.score} • Correct: {winner.correct_answers}/{winner.total_questions}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-lg font-bold text-green-600">
                                            +${winner.prize_fund}
                                        </div>
                                        <div className="text-xs text-muted-foreground">Prize</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </main>
    );
}

export default function QuizWinnersPage() {
    return (
        <ProtectedRoute requireAdmin>
            <WinnersPageContent />
        </ProtectedRoute>
    );
}
