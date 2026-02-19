'use client';

import Link from 'next/link';
import { useEffect, useState, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/providers/AuthProvider';
import { getScheduledQuizzes, Quiz } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency } from '@/lib/formatCurrency';
import { MobileBottomNav } from '@/components/MobileBottomNav';
import { PageHeader } from '@/components/PageHeader';
import { ArrowRight, Clock3, Gamepad2, Play, Trophy } from 'lucide-react';

export default function HomePage() {
    const { isAuthenticated, isLoading: authLoading } = useAuth();
    const [quizzes, setQuizzes] = useState<Quiz[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [timeRemaining, setTimeRemaining] = useState<{ days: number; hours: number; minutes: number; seconds: number }>({
        days: 0, hours: 0, minutes: 0, seconds: 0
    });
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    const tNav = useTranslations('nav');
    const tHome = useTranslations('home');
    const tQuiz = useTranslations('quiz');

    // Fetch scheduled quizzes
    useEffect(() => {
        const fetchQuizzes = async () => {
            try {
                const data = await getScheduledQuizzes();
                const sorted = data.sort((a, b) =>
                    new Date(a.scheduled_time).getTime() - new Date(b.scheduled_time).getTime()
                );
                setQuizzes(sorted);
            } catch (error) {
                console.error('Failed to fetch quizzes:', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchQuizzes();
    }, []);

    const upcomingQuiz = quizzes.find(q => new Date(q.scheduled_time) > new Date()) || null;

    // Countdown timer
    useEffect(() => {
        if (!upcomingQuiz) {
            setTimeRemaining({ days: 0, hours: 0, minutes: 0, seconds: 0 });
            return;
        }

        const updateTimer = () => {
            const now = new Date().getTime();
            const target = new Date(upcomingQuiz.scheduled_time).getTime();
            const diff = target - now;

            if (diff <= 0) {
                setTimeRemaining({ days: 0, hours: 0, minutes: 0, seconds: 0 });
                if (timerRef.current) clearInterval(timerRef.current);
                return;
            }

            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
            const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((diff % (1000 * 60)) / 1000);

            setTimeRemaining({ days, hours, minutes, seconds });
        };

        updateTimer();
        timerRef.current = setInterval(updateTimer, 1000);

        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [upcomingQuiz]);

    if (authLoading || isLoading) {
        return (
            <div className="min-h-app">
                {/* Header Skeleton */}
                <header className="border-b border-border/50 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
                    <div className="container max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
                        <Skeleton className="h-8 w-32" />
                        <Skeleton className="h-10 w-64" />
                    </div>
                </header>
                <main className="container max-w-6xl mx-auto px-4 py-16">
                    <div className="text-center mb-16">
                        <Skeleton className="h-8 w-48 mx-auto mb-4" />
                        <Skeleton className="h-16 w-96 mx-auto mb-4" />
                        <Skeleton className="h-6 w-80 mx-auto" />
                    </div>
                    <Skeleton className="h-80 w-full max-w-xl mx-auto rounded-2xl" />
                </main>
            </div>
        );
    }

    return (
        <div className="min-h-app">
            <PageHeader active='home' />

            {/* Hero Section */}
            <main className="container max-w-6xl mx-auto px-4 py-16 pb-28 md:pb-16">
                <div className="text-center mb-16">
                    {/* Badge */}
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                        </span>
                        {tQuiz('title')}
                    </div>

                    {/* Main Title */}
                    <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold mb-6">
                        <span className="text-gradient-hero">{tHome('welcome')}</span>
                    </h1>

                    {/* Subtitle */}
                    <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
                        {tHome('description')}
                    </p>

                    {/* CTA Buttons */}
                    <div className="flex flex-wrap justify-center gap-4 mb-8">
                        {isAuthenticated ? (
                            upcomingQuiz && (
                                <Button asChild size="lg" className="btn-coral text-base px-8">
                                    <Link href={`/quiz/${upcomingQuiz.id}/lobby`} className="flex items-center gap-2">
                                        <Play size={16} />
                                        {tQuiz('start')}
                                    </Link>
                                </Button>
                            )
                        ) : (
                            <>
                                <Button asChild size="lg" className="btn-coral text-base px-8">
                                    <Link href="/register" className="flex items-center gap-2">
                                        {tNav('register')}
                                        <ArrowRight size={16} />
                                    </Link>
                                </Button>
                                <Button asChild size="lg" variant="outline" className="text-base px-8">
                                    <Link href="/login">{tNav('login')}</Link>
                                </Button>
                            </>
                        )}
                    </div>

                    {/* How to play */}
                    <div className="text-left max-w-md mx-auto bg-muted/50 rounded-xl p-6 mb-8">
                        <h3 className="font-semibold mb-4">{tHome('howToPlay')}</h3>
                        <ol className="space-y-2 text-sm text-muted-foreground">
                            <li className="flex items-start gap-2">
                                <span className="text-primary font-bold">1.</span>
                                {tHome('step1')}
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-primary font-bold">2.</span>
                                {tHome('step2')}
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-primary font-bold">3.</span>
                                {tHome('step3')}
                            </li>
                        </ol>
                    </div>
                </div>

                {/* Next Game Card */}
                {upcomingQuiz ? (
                    <Card className="max-w-xl mx-auto card-elevated border-0 rounded-2xl overflow-hidden">
                        <CardHeader className="pb-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                                        <Trophy className="text-primary" size={20} />
                                    </div>
                                    <div>
                                        <CardTitle className="text-lg">{upcomingQuiz.title}</CardTitle>
                                        <p className="text-sm text-muted-foreground">{tQuiz('title')}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-2xl font-bold text-green-500">
                                        {formatCurrency(upcomingQuiz.prize_fund || 1000000)}
                                    </p>
                                    <p className="text-xs text-muted-foreground">{tQuiz('prizeFund', { amount: '' })}</p>
                                </div>
                            </div>
                        </CardHeader>

                        <CardContent className="pt-0">
                            {upcomingQuiz.description && (
                                <p className="text-sm text-muted-foreground mb-6">{upcomingQuiz.description}</p>
                            )}

                            {/* Timer */}
                            <div className="text-center mb-6">
                                <p className="text-sm text-muted-foreground mb-3">{tQuiz('countdown', { seconds: '' })}</p>
                                <div className="flex justify-center gap-2">
                                    <div className="timer-block">
                                        <div className="value">{String(timeRemaining.days).padStart(2, '0')}</div>
                                        <div className="label">{tQuiz('days')}</div>
                                    </div>
                                    <div className="timer-block">
                                        <div className="value">{String(timeRemaining.hours).padStart(2, '0')}</div>
                                        <div className="label">{tQuiz('hours')}</div>
                                    </div>
                                    <div className="timer-block">
                                        <div className="value">{String(timeRemaining.minutes).padStart(2, '0')}</div>
                                        <div className="label">{tQuiz('minutes')}</div>
                                    </div>
                                    <div className="timer-block">
                                        <div className="value">{String(timeRemaining.seconds).padStart(2, '0')}</div>
                                        <div className="label">{tQuiz('seconds')}</div>
                                    </div>
                                </div>
                            </div>

                            {/* Stats */}
                            <div className="flex justify-center text-sm text-muted-foreground">
                                <div className="flex items-center gap-1">
                                    <Clock3 className="h-4 w-4" />
                                    <span>{upcomingQuiz.question_count} {tQuiz('question', { current: '', total: '' })}</span>
                                </div>
                            </div>
                        </CardContent>

                        <CardFooter className="pt-0">
                            {isAuthenticated ? (
                                <Button asChild className="w-full btn-coral h-12 text-base">
                                    <Link href={`/quiz/${upcomingQuiz.id}/lobby`} className="flex items-center gap-2">
                                        <Play size={16} />
                                        {tQuiz('start')}
                                    </Link>
                                </Button>
                            ) : (
                                <Button asChild className="w-full btn-coral h-12 text-base">
                                    <Link href="/login">{tNav('login')}</Link>
                                </Button>
                            )}
                        </CardFooter>
                    </Card>
                ) : (
                    <Card className="max-w-xl mx-auto card-elevated border-0 rounded-2xl text-center py-12">
                        <CardContent>
                            <Gamepad2 className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                            <h3 className="text-xl font-semibold mb-2">{tQuiz('noActiveQuiz')}</h3>
                            <p className="text-muted-foreground">
                                {tQuiz('waiting')}
                            </p>
                        </CardContent>
                    </Card>
                )}

                <MobileBottomNav active="home" />
            </main>
        </div>
    );
}

