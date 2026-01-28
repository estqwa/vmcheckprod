'use client';

import Link from 'next/link';
import { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/providers/AuthProvider';
import { getScheduledQuizzes, Quiz } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export default function HomePage() {
  const { isAuthenticated, isLoading: authLoading, user, logout } = useAuth();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [timeRemaining, setTimeRemaining] = useState<{ days: number; hours: number; minutes: number; seconds: number }>({
    days: 0, hours: 0, minutes: 0, seconds: 0
  });
  const timerRef = useRef<NodeJS.Timeout | null>(null);

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
      <div className="min-h-screen">
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
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-border/50 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-white font-bold text-lg">Q</span>
            </div>
            <span className="font-bold text-xl text-foreground">QazaQuiz</span>
          </Link>

          {/* Navigation */}
          <nav className="hidden md:flex items-center gap-1">
            <Link href="/">
              <Button variant="ghost" size="sm" className="text-primary bg-primary/10">
                🏠 Главная
              </Button>
            </Link>
            <Link href="/leaderboard">
              <Button variant="ghost" size="sm">
                🏆 Рейтинг
              </Button>
            </Link>
            {isAuthenticated && (
              <Link href="/profile">
                <Button variant="ghost" size="sm">
                  👤 Профиль
                </Button>
              </Link>
            )}
          </nav>

          {/* Auth buttons */}
          <div className="flex items-center gap-2">
            {isAuthenticated ? (
              <>
                <span className="hidden sm:inline text-sm text-muted-foreground">
                  {user?.username}
                </span>
                <Button variant="outline" size="sm" onClick={() => logout()}>
                  Выйти
                </Button>
              </>
            ) : (
              <>
                <Link href="/login">
                  <Button variant="ghost" size="sm">Войти</Button>
                </Link>
                <Link href="/register">
                  <Button size="sm" className="btn-coral">
                    Начать бесплатно →
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="container max-w-6xl mx-auto px-4 py-16">
        <div className="text-center mb-16">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
            </span>
            Викторины в реальном времени
          </div>

          {/* Main Title */}
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold mb-6">
            <span className="text-gradient-hero">Соревнуйся. Побеждай. Празднуй.</span>
          </h1>

          {/* Subtitle */}
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
            Присоединяйся к тысячам игроков в онлайн-викторинах. Проверь свои знания,
            поднимись в рейтинге и выигрывай реальные призы!
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-wrap justify-center gap-4 mb-8">
            {isAuthenticated ? (
              upcomingQuiz && (
                <Link href={`/quiz/${upcomingQuiz.id}/lobby`}>
                  <Button size="lg" className="btn-coral text-base px-8">
                    ▶ Играть сейчас
                  </Button>
                </Link>
              )
            ) : (
              <>
                <Link href="/register">
                  <Button size="lg" className="btn-coral text-base px-8">
                    Начать бесплатно →
                  </Button>
                </Link>
                <Link href="/login">
                  <Button size="lg" variant="outline" className="text-base px-8">
                    Войти
                  </Button>
                </Link>
              </>
            )}
          </div>

          {/* Features */}
          <div className="flex flex-wrap justify-center gap-6 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <span className="text-green-500">✓</span>
              Реальные призы
            </div>
            <div className="flex items-center gap-2">
              <span className="text-green-500">✓</span>
              Живые соревнования
            </div>
            <div className="flex items-center gap-2">
              <span className="text-green-500">✓</span>
              Честная игра
            </div>
          </div>
        </div>

        {/* Next Game Card */}
        {upcomingQuiz ? (
          <Card className="max-w-xl mx-auto card-elevated border-0 rounded-2xl overflow-hidden">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <span className="text-primary text-xl">🏆</span>
                  </div>
                  <div>
                    <CardTitle className="text-lg">{upcomingQuiz.title}</CardTitle>
                    <p className="text-sm text-muted-foreground">Следующая викторина</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-green-500">$1000</p>
                  <p className="text-xs text-muted-foreground">Призовой фонд</p>
                </div>
              </div>
            </CardHeader>

            <CardContent className="pt-0">
              {upcomingQuiz.description && (
                <p className="text-sm text-muted-foreground mb-6">{upcomingQuiz.description}</p>
              )}

              {/* Timer */}
              <div className="text-center mb-6">
                <p className="text-sm text-muted-foreground mb-3">Начало соревнования через</p>
                <div className="flex justify-center gap-2">
                  <div className="timer-block">
                    <div className="value">{String(timeRemaining.days).padStart(2, '0')}</div>
                    <div className="label">Дней</div>
                  </div>
                  <div className="timer-block">
                    <div className="value">{String(timeRemaining.hours).padStart(2, '0')}</div>
                    <div className="label">Часов</div>
                  </div>
                  <div className="timer-block">
                    <div className="value">{String(timeRemaining.minutes).padStart(2, '0')}</div>
                    <div className="label">Минут</div>
                  </div>
                  <div className="timer-block">
                    <div className="value">{String(timeRemaining.seconds).padStart(2, '0')}</div>
                    <div className="label">Секунд</div>
                  </div>
                </div>
              </div>

              {/* Stats */}
              <div className="flex justify-between text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <span>👥</span>
                  <span>Зарегистрировано игроков</span>
                </div>
                <div className="flex items-center gap-1">
                  <span>⏱</span>
                  <span>{upcomingQuiz.question_count} вопросов</span>
                </div>
              </div>
            </CardContent>

            <CardFooter className="pt-0">
              {isAuthenticated ? (
                <Link href={`/quiz/${upcomingQuiz.id}/lobby`} className="w-full">
                  <Button className="w-full btn-coral h-12 text-base">
                    ▶ Присоединиться к игре
                  </Button>
                </Link>
              ) : (
                <Link href="/login" className="w-full">
                  <Button className="w-full btn-coral h-12 text-base">
                    Войти чтобы играть
                  </Button>
                </Link>
              )}
            </CardFooter>
          </Card>
        ) : (
          <Card className="max-w-xl mx-auto card-elevated border-0 rounded-2xl text-center py-12">
            <CardContent>
              <div className="text-5xl mb-4">🎮</div>
              <h3 className="text-xl font-semibold mb-2">Нет запланированных игр</h3>
              <p className="text-muted-foreground">
                Следите за обновлениями! Скоро появятся новые викторины.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Mobile Navigation */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-border/50 py-2 px-4">
          <div className="flex justify-around">
            <Link href="/" className="flex flex-col items-center text-primary">
              <span className="text-xl">🏠</span>
              <span className="text-xs">Главная</span>
            </Link>
            <Link href="/leaderboard" className="flex flex-col items-center text-muted-foreground">
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
      </main>
    </div>
  );
}
