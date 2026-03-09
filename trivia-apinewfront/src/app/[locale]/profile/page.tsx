'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/providers/AuthProvider';
import { GoogleCodeAuthButton } from '@/components/auth/GoogleCodeAuthButton';
import { getSessions, revokeSession, logoutAll, Session } from '@/lib/api';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
    const { user, logout, isAdmin, getEmailVerificationStatus, sendEmailVerificationCode, deleteAccount } = useAuth();
    const locale = useLocale();
    const [sessions, setSessions] = useState<Session[]>([]);
    const [isLoadingSessions, setIsLoadingSessions] = useState(true);
    const [isEmailActionLoading, setIsEmailActionLoading] = useState(false);
    const [verificationMeta, setVerificationMeta] = useState<{ canSend: boolean; cooldown: number } | null>(null);
    const [isDeletingAccount, setIsDeletingAccount] = useState(false);
    const [isDeleteFormOpen, setIsDeleteFormOpen] = useState(false);
    const [deletePassword, setDeletePassword] = useState('');
    const [deleteReason, setDeleteReason] = useState('');

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

    useEffect(() => {
        const loadVerificationStatus = async () => {
            if (!user || user.email_verified) return;
            try {
                const status = await getEmailVerificationStatus();
                setVerificationMeta({
                    canSend: status.can_send_code,
                    cooldown: status.cooldown_remaining_sec || 0,
                });
            } catch {
                // Silent: banner still renders from user.email_verified
            }
        };

        void loadVerificationStatus();
    }, [user, getEmailVerificationStatus]);

    const handleLogout = async () => {
        try {
            await logout();
            toast.success(t('logoutSuccess'));
            router.push('/');
        } catch {
            toast.error(tCommon('error'));
        }
    };

    const handleLogoutAll = async () => {
        try {
            await logoutAll();
            toast.success(t('logoutAllSuccess'));
            router.push('/login');
        } catch {
            toast.error(tCommon('error'));
        }
    };

    const handleRevokeSession = async (sessionId: number) => {
        try {
            await revokeSession(sessionId);
            setSessions(sessions.filter((session) => session.id !== sessionId));
            toast.success(t('sessionRevoked'));
        } catch {
            toast.error(tCommon('error'));
        }
    };

    const handleSendVerificationCode = async () => {
        setIsEmailActionLoading(true);
        try {
            await sendEmailVerificationCode();
            toast.success(t('verificationCodeSent'));
            const status = await getEmailVerificationStatus();
            setVerificationMeta({
                canSend: status.can_send_code,
                cooldown: status.cooldown_remaining_sec || 0,
            });
        } catch (error) {
            const err = error as { error?: string };
            toast.error(err.error || t('sendVerificationCodeError'));
        } finally {
            setIsEmailActionLoading(false);
        }
    };

    const closeDeleteForm = () => {
        setIsDeleteFormOpen(false);
        setDeletePassword('');
        setDeleteReason('');
    };

    const handleDeleteAccount = async () => {
        setIsDeletingAccount(true);
        try {
            await deleteAccount({
                password: deletePassword.trim() || undefined,
                reason: deleteReason.trim() || undefined,
            });
            toast.success(t('deleteAccountSuccess'));
            router.push('/login');
        } catch (error) {
            const err = error as { error?: string };
            toast.error(err.error || t('deleteAccountError'));
        } finally {
            setIsDeletingAccount(false);
        }
    };

    if (!user) return null;

    return (
        <div className="min-h-app mobile-nav-safe-area">
            <PageHeader active="profile" />

            <main className="container max-w-4xl mx-auto px-4 py-8">
                <h1 className="text-3xl font-bold mb-8">{t('title')}</h1>

                {!user.email_verified ? (
                    <Card className="mb-6 rounded-2xl border-amber-200 bg-amber-50/60">
                        <CardHeader>
                            <CardTitle className="text-lg text-amber-900">
                                {t('emailVerificationRequiredTitle')}
                            </CardTitle>
                            <CardDescription className="text-amber-800">
                                {t('emailVerificationRequiredDescription')}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="flex flex-col gap-3 sm:flex-row">
                            <Button asChild variant="outline" className="border-amber-300 bg-white">
                                <Link href="/verify-email">{t('openVerification')}</Link>
                            </Button>
                            <Button
                                type="button"
                                variant="secondary"
                                onClick={handleSendVerificationCode}
                                disabled={isEmailActionLoading || (verificationMeta?.cooldown ?? 0) > 0}
                            >
                                {(verificationMeta?.cooldown ?? 0) > 0
                                    ? t('resendIn', { seconds: verificationMeta?.cooldown ?? 0 })
                                    : t('sendCode')}
                            </Button>
                        </CardContent>
                    </Card>
                ) : null}

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
                                    {isAdmin ? <Badge className="bg-primary/10 text-primary">Admin</Badge> : null}
                                </CardTitle>
                                <CardDescription className="text-base">{user.email}</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                            <div className="rounded-xl bg-secondary/50 p-4 text-center">
                                <p className="text-3xl font-bold text-foreground">{user.games_played}</p>
                                <p className="text-sm text-muted-foreground">{t('gamesPlayed')}</p>
                            </div>
                            <div className="rounded-xl bg-primary/10 p-4 text-center">
                                <p className="text-3xl font-bold text-primary">{user.wins_count}</p>
                                <p className="text-sm text-muted-foreground">{t('winsCount')}</p>
                            </div>
                            <div className="rounded-xl bg-secondary/50 p-4 text-center">
                                <p className="text-3xl font-bold text-foreground">{user.total_score}</p>
                                <p className="text-sm text-muted-foreground">{t('totalScore')}</p>
                            </div>
                            <div className="rounded-xl bg-success/10 p-4 text-center">
                                <p className="text-3xl font-bold text-success break-words">{formatCurrency(user.total_prize_won, locale)}</p>
                                <p className="text-sm text-muted-foreground">{t('totalPrize')}</p>
                            </div>
                        </div>
                        {user.games_played > 0 ? (
                            <div className="mt-4 border-t border-border/50 pt-4">
                                <Button asChild variant="outline" className="w-full">
                                    <Link href="/profile/history" className="flex items-center gap-2">
                                        <History className="w-4 h-4" />
                                        {t('gameHistory')}
                                    </Link>
                                </Button>
                            </div>
                        ) : null}
                    </CardContent>
                </Card>

                <Card className="mb-6 card-elevated border-0 rounded-2xl">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Languages className="w-5 h-5 text-primary" />
                            {t('language')}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <p className="text-muted-foreground">{t('selectLanguage')}</p>
                            <LanguageSwitcher />
                        </div>
                    </CardContent>
                </Card>

                <Card className="mb-6 card-elevated border-0 rounded-2xl">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Shield className="w-5 h-5 text-primary" />
                            {t('sessions')}
                        </CardTitle>
                        <CardDescription>{t('sessionsDescription')}</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {isLoadingSessions ? (
                            <div className="space-y-3">
                                <Skeleton className="h-16 w-full rounded-xl" />
                                <Skeleton className="h-16 w-full rounded-xl" />
                            </div>
                        ) : sessions.length === 0 ? (
                            <p className="py-4 text-center text-muted-foreground">{t('noSessions')}</p>
                        ) : (
                            <div className="space-y-3">
                                {sessions.map((session) => (
                                    <div key={session.id} className="flex flex-col gap-3 rounded-xl bg-secondary/30 p-4 sm:flex-row sm:items-center sm:justify-between">
                                        <div>
                                            <p className="font-medium">{session.device_id || t('unknownDevice')}</p>
                                            <p className="text-xs text-muted-foreground">
                                                IP: {session.ip_address} • {formatDate(session.created_at)}
                                            </p>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleRevokeSession(session.id)}
                                            className="self-start text-destructive hover:text-destructive sm:self-auto"
                                        >
                                            {t('endSession')}
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card className="card-elevated border-0 rounded-2xl">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Settings className="w-5 h-5 text-primary" />
                            {t('actions')}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex flex-wrap gap-3">
                            {isAdmin ? (
                                <Button variant="outline" onClick={() => router.push('/admin')} className="h-11 flex items-center gap-2">
                                    <Wrench className="w-4 h-4" />
                                    Admin Panel
                                </Button>
                            ) : null}
                            <Button variant="outline" onClick={handleLogout} className="h-11 flex items-center gap-2">
                                <LogOut className="w-4 h-4" />
                                {tNav('logout')}
                            </Button>
                            <Button variant="destructive" onClick={handleLogoutAll} className="h-11">
                                {t('logoutAll')}
                            </Button>
                            <GoogleCodeAuthButton
                                label={t('linkGoogle')}
                                action="link"
                                returnPath="/profile"
                                className="h-11"
                                disabled={isDeletingAccount}
                                onError={(message) => toast.error(message)}
                            />
                        </div>

                        <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-4">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                <div className="space-y-1">
                                    <p className="font-semibold text-foreground">{t('deleteAccount')}</p>
                                    <p className="text-sm text-muted-foreground">{t('deleteAccountConfirm')}</p>
                                </div>
                                <Button
                                    type="button"
                                    variant={isDeleteFormOpen ? 'outline' : 'destructive'}
                                    className="h-11 sm:shrink-0"
                                    disabled={isDeletingAccount}
                                    onClick={() => {
                                        if (isDeleteFormOpen) {
                                            closeDeleteForm();
                                            return;
                                        }
                                        setIsDeleteFormOpen(true);
                                    }}
                                >
                                    {isDeleteFormOpen ? tCommon('cancel') : t('deleteAccount')}
                                </Button>
                            </div>

                            {isDeleteFormOpen ? (
                                <div className="mt-4 space-y-4 border-t border-destructive/10 pt-4">
                                    <div className="space-y-2">
                                        <p className="text-sm text-muted-foreground">{t('deleteAccountPromptPassword')}</p>
                                        <Input
                                            id="delete-password"
                                            type="password"
                                            autoComplete="current-password"
                                            value={deletePassword}
                                            onChange={(e) => setDeletePassword(e.target.value)}
                                            placeholder="password"
                                            className="h-12 bg-white"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <p className="text-sm text-muted-foreground">{t('deleteAccountPromptReason')}</p>
                                        <textarea
                                            value={deleteReason}
                                            onChange={(e) => setDeleteReason(e.target.value)}
                                            className="min-h-28 w-full rounded-md border border-input bg-white px-3 py-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                        />
                                    </div>
                                    <div className="flex flex-col gap-3 sm:flex-row">
                                        <Button type="button" variant="outline" className="h-11" onClick={closeDeleteForm} disabled={isDeletingAccount}>
                                            {tCommon('cancel')}
                                        </Button>
                                        <Button type="button" variant="destructive" className="h-11 sm:ml-auto" onClick={handleDeleteAccount} disabled={isDeletingAccount}>
                                            {isDeletingAccount ? t('deleting') : t('deleteAccount')}
                                        </Button>
                                    </div>
                                </div>
                            ) : null}
                        </div>
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
