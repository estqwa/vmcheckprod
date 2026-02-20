'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/providers/AuthProvider';
import { getSessions, revokeSession, logoutAll, Session } from '@/lib/api';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { Button } from '@/components/ui/button';
import { useLocale } from '@/components/LanguageSwitcher';
import { formatCurrency } from '@/lib/formatCurrency';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { MobileBottomNav } from '@/components/MobileBottomNav';
import { formatDate } from '@/lib/formatDate';
import { Languages, LogOut, Settings, Shield, History, Wrench } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';

function ProfileContent() {
    const router = useRouter();
    const { user, logout, isAdmin } = useAuth();
    const locale = useLocale();
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
            toast.success(t('logoutSuccess') || 'Logged out');
            router.push('/');
        } catch {
            toast.error(tCommon('error'));
        }
    };

    const handleLogoutAll = async () => {
        try {
            await logoutAll();
            toast.success(t('logoutAllSuccess') || 'Logged out from all devices');
            router.push('/login');
        } catch {
            toast.error(tCommon('error'));
        }
    };

    const handleRevokeSession = async (sessionId: number) => {
        try {
            await revokeSession(sessionId);
            setSessions(sessions.filter(s => s.id !== sessionId));
            toast.success(t('sessionRevoked') || 'Session revoked');
        } catch {
            toast.error(tCommon('error'));
        }
    };



    if (!user) return null;

    return (
        <div className="min-h-app pb-24 md:pb-0">
            <PageHeader active='profile' />

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
                                <p className="text-3xl font-bold text-green-600">{formatCurrency(user.total_prize_won, locale)}</p>
                                <p className="text-muted-foreground text-sm">{t('totalPrize')}</p>
                            </div>
                        </div>
                        {user.games_played > 0 && (
                            <div className="mt-4 pt-4 border-t border-border/50">
                                <Button asChild variant="outline" className="w-full">
                                    <Link href="/profile/history" className="flex items-center gap-2">
                                        <History className="w-4 h-4" />
                                        {t('gameHistory') || 'Game history'}
                                    </Link>
                                </Button>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Language Settings */}
                <Card className="mb-6 card-elevated border-0 rounded-2xl">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Languages className="w-5 h-5 text-primary" />
                            {t('language')}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center justify-between">
                            <p className="text-muted-foreground">{t('selectLanguage') || 'Choose interface language'}</p>
                            <LanguageSwitcher />
                        </div>
                    </CardContent>
                </Card>

                {/* Sessions Card */}
                <Card className="mb-6 card-elevated border-0 rounded-2xl">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Shield className="w-5 h-5 text-primary" />
                            {t('sessions') || 'Active sessions'}
                        </CardTitle>
                        <CardDescription>{t('sessionsDescription') || 'Manage your devices'}</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {isLoadingSessions ? (
                            <div className="space-y-3">
                                <Skeleton className="h-16 w-full rounded-xl" />
                                <Skeleton className="h-16 w-full rounded-xl" />
                            </div>
                        ) : sessions.length === 0 ? (
                            <p className="text-muted-foreground text-center py-4">{t('noSessions') || 'No active sessions'}</p>
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
                                            {t('endSession') || 'End session'}
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
                            <Settings className="w-5 h-5 text-primary" />
                            {t('actions') || 'Actions'}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-wrap gap-3">
                        {isAdmin && (
                            <Button variant="outline" onClick={() => router.push('/admin')} className="h-11 flex items-center gap-2">
                                <Wrench className="w-4 h-4" />
                                Admin Panel
                            </Button>
                        )}
                        <Button variant="outline" onClick={handleLogout} className="h-11 flex items-center gap-2">
                            <LogOut className="w-4 h-4" />
                            {tNav('logout')}
                        </Button>
                        <Button variant="destructive" onClick={handleLogoutAll} className="h-11">
                            {t('logoutAll') || 'Logout all'}
                        </Button>
                    </CardContent>
                </Card>
            </main>

            <MobileBottomNav active="profile" />
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

