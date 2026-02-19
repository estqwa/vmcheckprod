'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { getQuiz, getQuizResults, getMyResult, Quiz, QuizResult, PaginatedResults } from '@/lib/api';
import { useAuth } from '@/providers/AuthProvider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useLocale } from '@/components/LanguageSwitcher';
import { formatCurrency } from '@/lib/formatCurrency';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronLeft, ChevronRight, Medal, ShieldAlert, BarChart3, Trophy, Award, Gamepad2, Home } from 'lucide-react';
import { MobileBottomNav } from '@/components/MobileBottomNav';
import { PageHeader } from '@/components/PageHeader';

const PAGE_SIZE = 20;

export default function QuizResultsPage() {
    const params = useParams();
    const router = useRouter();
    const quizId = Number(params.id);
    const { user, isAuthenticated } = useAuth();
    const locale = useLocale();

    const t = useTranslations('quiz');
    const tNav = useTranslations('nav');
    const tLeaderboard = useTranslations('leaderboard');

    const [quiz, setQuiz] = useState<Quiz | null>(null);
    const [results, setResults] = useState<PaginatedResults<QuizResult> | null>(null);
    const [myResult, setMyResult] = useState<QuizResult | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const [isPageLoading, setIsPageLoading] = useState(false);

    const totalPages = results ? Math.max(1, Math.ceil(results.total / PAGE_SIZE)) : 1;

    const loadResultsPage = useCallback(async (page: number) => {
        try {
            setIsPageLoading(true);
            const resultsData = await getQuizResults(quizId, { page, page_size: PAGE_SIZE });
            setResults(resultsData);
            setCurrentPage(page);
        } catch (error) {
            console.error('Failed to load results page:', error);
        } finally {
            setIsPageLoading(false);
        }
    }, [quizId]);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [quizData, resultsData] = await Promise.all([
                    getQuiz(quizId),
                    getQuizResults(quizId, { page: 1, page_size: PAGE_SIZE }),
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
            <div className="min-h-app">
                <header className="border-b border-border/50 bg-white/80 backdrop-blur-sm">
                    <div className="container max-w-6xl mx-auto px-4 h-16 flex items-center">
                        <Skeleton className="h-8 w-32" />
                    </div>
                </header>
                <main className="container max-w-3xl mx-auto px-4 py-12">
                    <Skeleton className="h-8 w-48 mb-8" />
                    <Skeleton className="h-48 w-full mb-6 rounded-2xl" />
                    <Skeleton className="h-64 w-full rounded-2xl" />
                </main>
            </div>
        );
    }

    return (
        <div className="min-h-app pb-24 md:pb-0">
            <PageHeader
                rightSlot={(
                    <Button variant='ghost' onClick={() => router.push('/')} className='flex items-center gap-2'>
                        <Home className='w-4 h-4' />
                        {tNav('home')}
                    </Button>
                )}
            />

            <main className="container max-w-3xl mx-auto px-4 py-8">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold">{t('gameOver')}</h1>
                    {quiz && <p className="text-muted-foreground">{quiz.title}</p>}
                </div>

                {/* My Result Card */}
                {myResult && (
                    <Card className={`mb-6 card-elevated border-0 rounded-2xl overflow-hidden ${myResult.is_winner ? 'ring-2 ring-yellow-400' : ''
                        }`}>
                        <CardHeader className={`${myResult.is_winner
                            ? 'bg-gradient-to-r from-yellow-50 to-orange-50'
                            : myResult.is_eliminated
                                ? 'bg-gradient-to-r from-orange-50 to-red-50'
                                : 'bg-gradient-to-b from-primary/5 to-transparent'
                            }`}>
                            <CardTitle className="flex items-center gap-2">
                                {myResult.is_winner ? (
                                    <Trophy className="w-6 h-6 text-yellow-600" />
                                ) : myResult.is_eliminated ? (
                                    <ShieldAlert className="w-6 h-6 text-orange-600" />
                                ) : (
                                    <BarChart3 className="w-6 h-6 text-primary" />
                                )}
                                {t('score').replace(': {score}', '')}
                                {myResult.is_winner && <Badge className="bg-yellow-400 text-yellow-900 border-0">{t('winner')}</Badge>}
                                {myResult.is_eliminated && <Badge className="bg-orange-100 text-orange-700 border-0">{t('eliminated')}</Badge>}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="bg-secondary/50 rounded-xl p-4 text-center">
                                    <p className="text-3xl font-bold">#{myResult.rank}</p>
                                    <p className="text-muted-foreground text-sm">{tLeaderboard('rank')}</p>
                                </div>
                                <div className="bg-primary/10 rounded-xl p-4 text-center">
                                    <p className="text-3xl font-bold text-primary">{myResult.score}</p>
                                    <p className="text-muted-foreground text-sm">{t('score').replace(': {score}', '')}</p>
                                </div>
                                <div className="bg-secondary/50 rounded-xl p-4 text-center">
                                    <p className="text-3xl font-bold">{myResult.correct_answers}/{myResult.total_questions}</p>
                                    <p className="text-muted-foreground text-sm">{t('correct')}</p>
                                </div>
                                {myResult.prize_fund > 0 && (
                                    <div className="bg-green-50 rounded-xl p-4 text-center">
                                        <p className="text-3xl font-bold text-green-600">{formatCurrency(myResult.prize_fund, locale)}</p>
                                        <p className="text-muted-foreground text-sm">{tLeaderboard('prize')}</p>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* All Results */}
                <Card className="card-elevated border-0 rounded-2xl">
                    <CardHeader>
                        <CardTitle className="flex items-center justify-between">
                            <span className="flex items-center gap-2">
                                <Trophy className="w-5 h-5 text-primary" />
                                {tLeaderboard('title')}
                            </span>
                            {results && results.total > 0 && (
                                <span className="text-sm font-normal text-muted-foreground">
                                    {results.total} СѓС‡Р°СЃС‚РЅРёРєРѕРІ
                                </span>
                            )}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {!results || results.results.length === 0 ? (
                            <div className="text-center py-12">
                                <Gamepad2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                                <p className="text-muted-foreground">{tLeaderboard('noPlayers')}</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {isPageLoading ? (
                                    [...Array(5)].map((_, i) => (
                                        <Skeleton key={i} className="h-16 w-full rounded-xl" />
                                    ))
                                ) : (
                                    results.results.map((result) => (
                                        <div
                                            key={result.id}
                                            className={`flex items-center gap-4 p-4 rounded-xl border-2 transition-all ${result.user_id === user?.id
                                                ? 'border-primary/50 bg-primary/5'
                                                : result.is_winner
                                                    ? 'border-yellow-300 bg-yellow-50'
                                                    : 'border-transparent bg-secondary/30'
                                                }`}
                                        >
                                            {/* Rank */}
                                            <div className="w-10 text-center flex-shrink-0">
                                                {result.rank <= 3 ? (
                                                    <span className="text-2xl inline-flex items-center justify-center">
                                                        {result.rank === 1 ? (
                                                            <Trophy className="w-6 h-6 text-yellow-600" />
                                                        ) : result.rank === 2 ? (
                                                            <Medal className="w-6 h-6 text-slate-500" />
                                                        ) : (
                                                            <Award className="w-6 h-6 text-amber-700" />
                                                        )}
                                                    </span>
                                                ) : (
                                                    <span className="font-bold text-lg text-muted-foreground">#{result.rank}</span>
                                                )}
                                            </div>

                                            {/* Avatar & Name */}
                                            <Avatar className="h-10 w-10 border-2 border-white shadow-sm">
                                                <AvatarImage src={result.profile_picture} />
                                                <AvatarFallback className="bg-primary/10 text-primary text-sm">
                                                    {result.username.substring(0, 2).toUpperCase()}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-medium truncate">
                                                    {result.username}
                                                    {result.user_id === user?.id && <span className="text-muted-foreground"> (You)</span>}
                                                </p>
                                                <p className="text-sm text-muted-foreground">
                                                    {result.correct_answers}/{result.total_questions} {t('correct')}
                                                </p>
                                            </div>

                                            {/* Stats */}
                                            <div className="flex items-center gap-2">
                                                <Badge variant="outline" className="font-bold">{result.score}</Badge>
                                                {result.prize_fund > 0 && (
                                                    <Badge className="bg-green-500 border-0">{formatCurrency(result.prize_fund, locale)}</Badge>
                                                )}
                                                {result.is_eliminated && (
                                                    <Badge className="bg-orange-100 text-orange-700 border-0 text-xs">{t('eliminated')}</Badge>
                                                )}
                                            </div>
                                        </div>
                                    ))
                                )}

                                {/* Pagination */}
                                {totalPages > 1 && (
                                    <div className="flex items-center justify-center gap-2 pt-4 border-t">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            disabled={currentPage === 1 || isPageLoading}
                                            onClick={() => loadResultsPage(currentPage - 1)}
                                        >
                                            <ChevronLeft className="w-4 h-4" />
                                        </Button>
                                        <span className="px-4 py-2 text-sm text-muted-foreground">
                                            {currentPage} / {totalPages}
                                        </span>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            disabled={currentPage >= totalPages || isPageLoading}
                                            onClick={() => loadResultsPage(currentPage + 1)}
                                        >
                                            <ChevronRight className="w-4 h-4" />
                                        </Button>
                                    </div>
                                )}
                            </div>
                        )}
                    </CardContent>
                </Card>

                <div className="text-center mt-8">
                    <Button className="btn-coral px-8 inline-flex items-center gap-2" size="lg" onClick={() => router.push('/')}>
                        <Home className="w-4 h-4" />
                        {tNav('home')}
                    </Button>
                </div>
            </main>

            {/* Mobile Navigation */}
            <MobileBottomNav />
        </div>
    );
}


