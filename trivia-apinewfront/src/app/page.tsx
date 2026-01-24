'use client';

import Link from 'next/link';
import { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/providers/AuthProvider';
import { getScheduledQuizzes, Quiz } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export default function HomePage() {
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [timeRemaining, setTimeRemaining] = useState<string>('');
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch scheduled quizzes
  useEffect(() => {
    const fetchQuizzes = async () => {
      try {
        const data = await getScheduledQuizzes();
        // Sort by scheduled_time ascending
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

  // Find the next upcoming quiz
  const upcomingQuiz = quizzes.find(q => new Date(q.scheduled_time) > new Date()) || null;

  // Countdown timer
  useEffect(() => {
    if (!upcomingQuiz) {
      setTimeRemaining('');
      return;
    }

    const updateTimer = () => {
      const now = new Date().getTime();
      const target = new Date(upcomingQuiz.scheduled_time).getTime();
      const diff = target - now;

      if (diff <= 0) {
        setTimeRemaining('Starting...');
        if (timerRef.current) clearInterval(timerRef.current);
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeRemaining(
        `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
      );
    };

    updateTimer();
    timerRef.current = setInterval(updateTimer, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [upcomingQuiz]);

  if (authLoading || isLoading) {
    return (
      <main className="flex flex-col items-center justify-center min-h-screen px-4 py-12">
        <div className="text-center mb-12">
          <Skeleton className="h-12 w-80 mx-auto mb-4" />
          <Skeleton className="h-6 w-96 mx-auto" />
        </div>
        <Skeleton className="h-64 w-full max-w-md" />
      </main>
    );
  }

  return (
    <main className="flex flex-col items-center justify-center min-h-screen px-4 py-12">
      {/* Hero */}
      <div className="text-center mb-12">
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold bg-gradient-to-r from-violet-500 to-indigo-500 bg-clip-text text-transparent mb-4">
          Live Trivia. Real Prizes.
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl">
          Join thousands of players in live quiz competitions and win cash prizes by answering questions correctly and quickly.
        </p>
      </div>

      {/* Next Game Card */}
      <div className="w-full max-w-md">
        {upcomingQuiz ? (
          <Card className="border-border/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-center text-2xl">Next Game</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="text-center">
                <p className="text-muted-foreground mb-1">Starts in:</p>
                <p className="text-4xl font-mono font-bold text-primary">{timeRemaining || '00:00:00'}</p>
              </div>

              <div className="text-center">
                <h3 className="font-semibold text-lg">{upcomingQuiz.title}</h3>
                {upcomingQuiz.description && (
                  <p className="text-muted-foreground text-sm mt-1">{upcomingQuiz.description}</p>
                )}
              </div>

              <div className="flex justify-center gap-8 text-center">
                <div>
                  <p className="text-2xl font-bold">{upcomingQuiz.question_count}</p>
                  <p className="text-muted-foreground text-sm">Questions</p>
                </div>
              </div>
            </CardContent>
            <CardFooter>
              {isAuthenticated ? (
                <Link href={`/quiz/${upcomingQuiz.id}/lobby`} className="w-full">
                  <Button className="w-full" size="lg">
                    Join Game
                  </Button>
                </Link>
              ) : (
                <Link href="/login" className="w-full">
                  <Button className="w-full" size="lg">
                    Login to Play
                  </Button>
                </Link>
              )}
            </CardFooter>
          </Card>
        ) : (
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="text-center">No Upcoming Games</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-center text-muted-foreground py-6">
                No games scheduled at the moment. Check back soon!
              </p>
            </CardContent>
          </Card>
        )}

        {/* Auth buttons */}
        {!isAuthenticated ? (
          <div className="flex justify-center gap-4 mt-8">
            <Link href="/login">
              <Button variant="outline">Login</Button>
            </Link>
            <Link href="/register">
              <Button>Register</Button>
            </Link>
          </div>
        ) : (
          <div className="flex justify-center gap-4 mt-8">
            <p className="text-muted-foreground">
              Welcome, <span className="font-semibold text-foreground">{user?.username}</span>!
            </p>
          </div>
        )}

        {/* Navigation Links */}
        <div className="flex justify-center gap-6 mt-8">
          <Link href="/leaderboard">
            <Button variant="ghost">Leaderboard</Button>
          </Link>
          {isAuthenticated && (
            <Link href="/profile">
              <Button variant="ghost">Profile</Button>
            </Link>
          )}
        </div>
      </div>
    </main>
  );
}
