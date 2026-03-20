'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { getQuiz, getQuizResults, getMyResult, Quiz, QuizResult, PaginatedResults } from '@/lib/api';
import { useAuth } from '@/providers/AuthProvider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { StatTile } from '@/components/ui/stat-tile';
import { StatusBadge } from '@/components/ui/status-badge';
import { useLocale } from '@/components/LanguageSwitcher';
import { formatCurrency } from '@/lib/formatCurrency';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
        <div className="min-h-app mobile-nav-safe-area">
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
                                    <Trophy className="w-6 h-6 text-yellow-800" />
                                ) : myResult.is_eliminated ? (
                                    <ShieldAlert className="w-6 h-6 text-orange-600" />
                                ) : (
                                    <BarChart3 className="w-6 h-6 text-primary" />
                                )}
                                {t('score').replace(': {score}', '')}
                                {myResult.is_winner ? (
                                    <StatusBadge tone="warning" icon={<Trophy className="h-3 w-3" />}>
                                        {t('winner')}
                                    </StatusBadge>
                                ) : null}
                                {myResult.is_eliminated ? (
                                    <StatusBadge tone="danger" icon={<ShieldAlert className="h-3 w-3" />}>
                                        {t('eliminated')}
                                    </StatusBadge>
                                ) : null}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <StatTile
                                    label={tLeaderboard('rank')}
                                    value={`#${myResult.rank}`}
                                    size="compact"
                                />
                                <StatTile
                                    label={t('score').replace(': {score}', '')}
                                    value={myResult.score}
                                    tone="primary"
                                    size="compact"
                                />
                                <StatTile
                                    label={t('correct')}
                                    value={`${myResult.correct_answers}/${myResult.total_questions}`}
                                    size="compact"
                                />
                                {myResult.prize_fund > 0 && (
                                    <StatTile
                                        label={tLeaderboard('prize')}
                                        value={formatCurrency(myResult.prize_fund, locale)}
                                        tone="success"
                                        size="compact"
                                    />
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
                                    {t('participants', { count: results.total })}
                                </span>
                            )}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {!results || results.results.length === 0 ? (
                            <EmptyState
                                icon={<Gamepad2 className="h-12 w-12" />}
                                title={tLeaderboard('noPlayers')}
                            />
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
                                                            <Trophy className="w-6 h-6 text-yellow-800" />
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
                                                    {result.user_id === user?.id && <span className="text-muted-foreground"> ({t('you')})</span>}
                                                </p>
                                                <p className="text-sm text-muted-foreground">
                                                    {result.correct_answers}/{result.total_questions} {t('correct')}
                                                </p>
                                            </div>

                                            {/* Stats */}
                                            <div className="flex items-center gap-2">
                                                <StatusBadge tone="info">{result.score}</StatusBadge>
                                                {result.prize_fund > 0 && (
                                                    <StatusBadge tone="success">{formatCurrency(result.prize_fund, locale)}</StatusBadge>
                                                )}
                                                {result.is_eliminated && (
                                                    <StatusBadge tone="danger">{t('eliminated')}</StatusBadge>
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
                                            aria-label="Previous page"
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
                                            aria-label="Next page"
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


