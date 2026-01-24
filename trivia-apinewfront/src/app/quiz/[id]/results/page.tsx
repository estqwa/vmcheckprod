'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { getQuiz, getQuizResults, getMyResult, Quiz, QuizResult, PaginatedResults } from '@/lib/api';
import { useAuth } from '@/providers/AuthProvider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

export default function QuizResultsPage() {
    const params = useParams();
    const router = useRouter();
    const quizId = Number(params.id);
    const { user, isAuthenticated } = useAuth();

    const [quiz, setQuiz] = useState<Quiz | null>(null);
    const [results, setResults] = useState<PaginatedResults<QuizResult> | null>(null);
    const [myResult, setMyResult] = useState<QuizResult | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [quizData, resultsData] = await Promise.all([
                    getQuiz(quizId),
                    getQuizResults(quizId, { page: 1, page_size: 20 }),
                ]);
                setQuiz(quizData);
                setResults(resultsData);

                if (isAuthenticated) {
                    const myResultData = await getMyResult(quizId);
                    setMyResult(myResultData);
                }
            } catch (error) {
                console.error('Failed to fetch results:', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [quizId, isAuthenticated]);

    if (isLoading) {
        return (
            <main className="container max-w-3xl mx-auto px-4 py-12">
                <Skeleton className="h-8 w-48 mb-8" />
                <Skeleton className="h-48 w-full mb-6" />
                <Skeleton className="h-64 w-full" />
            </main>
        );
    }

    return (
        <main className="container max-w-3xl mx-auto px-4 py-12">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold">Results</h1>
                    {quiz && <p className="text-muted-foreground">{quiz.title}</p>}
                </div>
                <Link href="/">
                    <Button variant="ghost">← Home</Button>
                </Link>
            </div>

            {/* My Result Card */}
            {myResult && (
                <Card className={`mb-8 ${myResult.is_winner ? 'border-yellow-500' : myResult.is_eliminated ? 'border-red-500/50' : ''}`}>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            Your Result
                            {myResult.is_winner && <Badge className="bg-yellow-500">🏆 Winner!</Badge>}
                            {myResult.is_eliminated && <Badge variant="destructive">Eliminated</Badge>}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                            <div>
                                <p className="text-3xl font-bold">#{myResult.rank}</p>
                                <p className="text-muted-foreground text-sm">Rank</p>
                            </div>
                            <div>
                                <p className="text-3xl font-bold">{myResult.score}</p>
                                <p className="text-muted-foreground text-sm">Score</p>
                            </div>
                            <div>
                                <p className="text-3xl font-bold">{myResult.correct_answers}/{myResult.total_questions}</p>
                                <p className="text-muted-foreground text-sm">Correct</p>
                            </div>
                            {myResult.prize_fund > 0 && (
                                <div>
                                    <p className="text-3xl font-bold text-green-500">${myResult.prize_fund}</p>
                                    <p className="text-muted-foreground text-sm">Prize Won</p>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* All Results */}
            <Card>
                <CardHeader>
                    <CardTitle>Leaderboard</CardTitle>
                </CardHeader>
                <CardContent>
                    {!results || results.results.length === 0 ? (
                        <p className="text-muted-foreground text-center py-8">No results yet</p>
                    ) : (
                        <div className="space-y-3">
                            {results.results.map((result) => (
                                <div
                                    key={result.id}
                                    className={`flex items-center gap-4 p-3 rounded-lg border ${result.user_id === user?.id ? 'border-primary bg-primary/5' : ''
                                        } ${result.is_winner ? 'border-yellow-500/50 bg-yellow-500/5' : ''}`}
                                >
                                    {/* Rank */}
                                    <div className="w-10 text-center">
                                        {result.rank <= 3 ? (
                                            <span className="text-xl">
                                                {result.rank === 1 ? '🥇' : result.rank === 2 ? '🥈' : '🥉'}
                                            </span>
                                        ) : (
                                            <span className="font-bold text-muted-foreground">#{result.rank}</span>
                                        )}
                                    </div>

                                    {/* Avatar & Name */}
                                    <Avatar className="h-8 w-8">
                                        <AvatarImage src={result.profile_picture} />
                                        <AvatarFallback className="text-xs">
                                            {result.username.substring(0, 2).toUpperCase()}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1">
                                        <p className="font-medium">
                                            {result.username}
                                            {result.user_id === user?.id && <span className="text-muted-foreground"> (You)</span>}
                                        </p>
                                    </div>

                                    {/* Stats */}
                                    <div className="flex items-center gap-4 text-sm">
                                        <span>{result.correct_answers}/{result.total_questions}</span>
                                        <Badge variant="outline">{result.score} pts</Badge>
                                        {result.prize_fund > 0 && (
                                            <Badge className="bg-green-500">${result.prize_fund}</Badge>
                                        )}
                                        {result.is_eliminated && (
                                            <Badge variant="destructive" className="text-xs">Out</Badge>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            <div className="text-center mt-8">
                <Button onClick={() => router.push('/')}>
                    Back to Home
                </Button>
            </div>
        </main>
    );
}
