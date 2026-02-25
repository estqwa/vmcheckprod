'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/providers/AuthProvider';
import type { EmailVerificationStatus } from '@/lib/api/types';

function VerifyEmailContent() {
    const t = useTranslations('auth');
    const { user, getEmailVerificationStatus, sendEmailVerificationCode, confirmEmailVerificationCode, refetchUser } = useAuth();
    const [status, setStatus] = useState<EmailVerificationStatus | null>(null);
    const [code, setCode] = useState('');
    const [isBusy, setIsBusy] = useState(false);
    const [cooldown, setCooldown] = useState(0);

    const loadStatus = useCallback(async () => {
        try {
            const nextStatus = await getEmailVerificationStatus();
            setStatus(nextStatus);
            setCooldown(Math.max(0, nextStatus.cooldown_remaining_sec || 0));
        } catch (error: unknown) {
            const err = error as { error?: string };
            toast.error(err.error || 'Failed to load verification status');
        }
    }, [getEmailVerificationStatus]);

    useEffect(() => {
        void loadStatus();
    }, [loadStatus]);

    useEffect(() => {
        if (cooldown <= 0) return;
        const id = window.setInterval(() => {
            setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
        }, 1000);
        return () => window.clearInterval(id);
    }, [cooldown]);

    const canSend = useMemo(() => {
        if (!status) return false;
        if (status.email_verified) return false;
        return status.can_send_code && cooldown <= 0;
    }, [status, cooldown]);

    const handleSend = async () => {
        setIsBusy(true);
        try {
            await sendEmailVerificationCode();
            toast.success('Verification code sent');
            await loadStatus();
        } catch (error: unknown) {
            const err = error as { error?: string };
            toast.error(err.error || 'Failed to send verification code');
        } finally {
            setIsBusy(false);
        }
    };

    const handleConfirm = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsBusy(true);
        try {
            await confirmEmailVerificationCode({ code: code.trim() });
            await refetchUser();
            toast.success('Email verified');
            setCode('');
            await loadStatus();
        } catch (error: unknown) {
            const err = error as { error?: string };
            toast.error(err.error || 'Failed to verify code');
        } finally {
            setIsBusy(false);
        }
    };

    return (
        <div className="min-h-app flex items-center justify-center px-4 py-10">
            <Card className="w-full max-w-md">
                <CardHeader>
                    <CardTitle>{t('verifyEmailTitle') || 'Verify your email'}</CardTitle>
                    <CardDescription>
                        {status?.email || user?.email || ''}
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {status?.email_verified ? (
                        <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">
                            {t('emailVerified') || 'Your email is verified. Prize eligibility is active.'}
                        </div>
                    ) : (
                        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                            {t('emailNotVerifiedHint') || 'Verify email to unlock prize eligibility and secure account recovery.'}
                        </div>
                    )}

                    <div className="space-y-2 text-sm text-muted-foreground">
                        <p>{t('verifyAttemptsLeft') || 'Attempts left'}: {status?.attempts_left ?? '-'}</p>
                        {cooldown > 0 && <p>{t('verifyResendCooldown') || 'Resend available in'}: {cooldown}s</p>}
                        {status?.expires_at && <p>{t('verifyExpiresAt') || 'Code expires at'}: {new Date(status.expires_at).toLocaleString()}</p>}
                    </div>

                    <Button type="button" variant="outline" className="w-full" onClick={handleSend} disabled={isBusy || !canSend}>
                        {cooldown > 0 ? `${t('resendCode') || 'Resend code'} (${cooldown}s)` : (t('sendCode') || 'Send code')}
                    </Button>

                    <form onSubmit={handleConfirm} className="space-y-3">
                        <div className="space-y-2">
                            <Label htmlFor="verify-code">{t('verificationCode') || 'Verification code'}</Label>
                            <Input
                                id="verify-code"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                maxLength={6}
                                value={code}
                                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                placeholder="123456"
                                disabled={isBusy || !!status?.email_verified}
                            />
                        </div>
                        <Button type="submit" className="w-full" disabled={isBusy || code.length !== 6 || !!status?.email_verified}>
                            {t('confirmCode') || 'Confirm code'}
                        </Button>
                    </form>
                </CardContent>
                <CardFooter className="flex justify-between gap-2">
                    <Button asChild variant="ghost">
                        <Link href="/">{t('backToHome') || 'Back to home'}</Link>
                    </Button>
                    <Button type="button" variant="outline" onClick={() => void loadStatus()} disabled={isBusy}>
                        {t('refreshStatus') || 'Refresh status'}
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}

export default function VerifyEmailPage() {
    return (
        <ProtectedRoute>
            <VerifyEmailContent />
        </ProtectedRoute>
    );
}

