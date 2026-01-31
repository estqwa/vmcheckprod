'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/providers/AuthProvider';
import { getSessions, revokeSession, logoutAll, Session } from '@/lib/api';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';

function ProfileContent() {
    const router = useRouter();
    const { user, logout, isAdmin } = useAuth();
    const [sessions, setSessions] = useState<Session[]>([]);
    const [isLoadingSessions, setIsLoadingSessions] = useState(true);

    const t = useTranslations('profile');
    const tNav = useTranslations('nav');
    const tCommon = useTranslations('common');

    useEffect(() => {
        const fetchSessions = async () => {
            try {
                const data = await getSessions();
                setSessions(data.sessions || []);
            } catch (error) {
                console.error('Failed to fetch sessions:', error);
            } finally {
                setIsLoadingSessions(false);
            }
        };

        fetchSessions();
    }, []);

    const handleLogout = async () => {
        try {
            await logout();
            toast.success(t('logoutSuccess') || 'Вы вышли из аккаунта');
            router.push('/');
        } catch {
            toast.error(tCommon('error'));
        }
    };

    const handleLogoutAll = async () => {
        try {
            await logoutAll();
            toast.success(t('logoutAllSuccess') || 'Вы вышли со всех устройств');
            router.push('/login');
        } catch {
            toast.error(tCommon('error'));
        }
    };

    const handleRevokeSession = async (sessionId: number) => {
        try {
            await revokeSession(sessionId);
            setSessions(sessions.filter(s => s.id !== sessionId));
            toast.success(t('sessionRevoked') || 'Сессия завершена');
        } catch {
            toast.error(tCommon('error'));
        }
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleString();
    };

    if (!user) return null;

    return (
        <div className="min-h-screen pb-24 md:pb-0">
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
                            <Button variant="ghost" size="sm">🏠 {tNav('home')}</Button>
                        </Link>
                        <Link href="/leaderboard">
                            <Button variant="ghost" size="sm">🏆 {tNav('leaderboard')}</Button>
                        </Link>
                        <Link href="/profile">
                            <Button variant="ghost" size="sm" className="text-primary bg-primary/10">👤 {tNav('profile')}</Button>
                        </Link>
                    </nav>
                    <LanguageSwitcher />
                </div>
            </header>

            <main className="container max-w-4xl mx-auto px-4 py-8">
                <h1 className="text-3xl font-bold mb-8">{t('title')}</h1>

                {/* User Info Card */}
                <Card className="mb-6 card-elevated border-0 rounded-2xl">
                    <CardHeader>
                        <div className="flex items-center gap-4">
                            <Avatar className="h-20 w-20 border-4 border-primary/20">
                                <AvatarImage src={user.profile_picture} />
                                <AvatarFallback className="text-2xl bg-primary/10 text-primary">
                                    {user.username.substring(0, 2).toUpperCase()}
                                </AvatarFallback>
                            </Avatar>
                            <div>
                                <CardTitle className="flex items-center gap-2 text-2xl">
                                    {user.username}
                                    {isAdmin && <Badge className="bg-primary/10 text-primary">Admin</Badge>}
                                </CardTitle>
                                <CardDescription className="text-base">{user.email}</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="bg-secondary/50 rounded-xl p-4 text-center">
                                <p className="text-3xl font-bold text-foreground">{user.games_played}</p>
                                <p className="text-muted-foreground text-sm">{t('gamesPlayed')}</p>
                            </div>
                            <div className="bg-primary/10 rounded-xl p-4 text-center">
                                <p className="text-3xl font-bold text-primary">{user.wins_count}</p>
                                <p className="text-muted-foreground text-sm">{t('winsCount')}</p>
                            </div>
                            <div className="bg-secondary/50 rounded-xl p-4 text-center">
                                <p className="text-3xl font-bold text-foreground">{user.total_score}</p>
                                <p className="text-muted-foreground text-sm">{t('totalScore')}</p>
                            </div>
                            <div className="bg-green-500/10 rounded-xl p-4 text-center">
                                <p className="text-3xl font-bold text-green-600">${user.total_prize_won}</p>
                                <p className="text-muted-foreground text-sm">{t('totalPrize')}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Language Settings */}
                <Card className="mb-6 card-elevated border-0 rounded-2xl">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <span>🌐</span> {t('language')}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center justify-between">
                            <p className="text-muted-foreground">{t('selectLanguage') || 'Выберите язык интерфейса'}</p>
                            <LanguageSwitcher />
                        </div>
                    </CardContent>
                </Card>

                {/* Sessions Card */}
                <Card className="mb-6 card-elevated border-0 rounded-2xl">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <span>🔐</span> {t('sessions') || 'Активные сессии'}
                        </CardTitle>
                        <CardDescription>{t('sessionsDescription') || 'Управляйте устройствами'}</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {isLoadingSessions ? (
                            <div className="space-y-3">
                                <Skeleton className="h-16 w-full rounded-xl" />
                                <Skeleton className="h-16 w-full rounded-xl" />
                            </div>
                        ) : sessions.length === 0 ? (
                            <p className="text-muted-foreground text-center py-4">{t('noSessions') || 'Нет активных сессий'}</p>
                        ) : (
                            <div className="space-y-3">
                                {sessions.map((session) => (
                                    <div key={session.id} className="flex items-center justify-between p-4 rounded-xl bg-secondary/30">
                                        <div>
                                            <p className="font-medium">{session.device_id || 'Unknown'}</p>
                                            <p className="text-xs text-muted-foreground">
                                                IP: {session.ip_address} • {formatDate(session.created_at)}
                                            </p>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleRevokeSession(session.id)}
                                            className="text-destructive hover:text-destructive"
                                        >
                                            {t('endSession') || 'Завершить'}
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Actions Card */}
                <Card className="card-elevated border-0 rounded-2xl">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <span>⚙️</span> {t('actions') || 'Действия'}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-wrap gap-3">
                        {isAdmin && (
                            <Button variant="outline" onClick={() => router.push('/admin')} className="h-11">
                                🛠 Admin Panel
                            </Button>
                        )}
                        <Button variant="outline" onClick={handleLogout} className="h-11">
                            {tNav('logout')}
                        </Button>
                        <Button variant="destructive" onClick={handleLogoutAll} className="h-11">
                            {t('logoutAll') || 'Выйти со всех устройств'}
                        </Button>
                    </CardContent>
                </Card>
            </main>

            {/* Mobile Navigation */}
            <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-border/50 py-2 px-4">
                <div className="flex justify-around">
                    <Link href="/" className="flex flex-col items-center text-muted-foreground">
                        <span className="text-xl">🏠</span>
                        <span className="text-xs">{tNav('home')}</span>
                    </Link>
                    <Link href="/leaderboard" className="flex flex-col items-center text-muted-foreground">
                        <span className="text-xl">🏆</span>
                        <span className="text-xs">{tNav('leaderboard')}</span>
                    </Link>
                    <Link href="/profile" className="flex flex-col items-center text-primary">
                        <span className="text-xl">👤</span>
                        <span className="text-xs">{tNav('profile')}</span>
                    </Link>
                </div>
            </div>
        </div>
    );
}

export default function ProfilePage() {
    return (
        <ProtectedRoute>
            <ProfileContent />
        </ProtectedRoute>
    );
}
