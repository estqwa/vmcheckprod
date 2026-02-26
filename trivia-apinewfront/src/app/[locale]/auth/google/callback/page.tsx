'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { useAuth } from '@/providers/AuthProvider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
    consumeGoogleAuthRedirectState,
    getLocalePrefixFromPath,
    type GoogleAuthRedirectAction,
} from '@/lib/auth/googleRedirectState';

type RedirectState = {
    action: GoogleAuthRedirectAction;
    returnPath: string;
};

export default function GoogleAuthCallbackPage() {
    const t = useTranslations('auth');
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const { loginWithGoogle, linkGoogle } = useAuth();
    const startedRef = useRef(false);
    const [statusText, setStatusText] = useState<string>(t('googleLoginProcessing'));

    useEffect(() => {
        if (startedRef.current) return;
        startedRef.current = true;

        const localePrefix = getLocalePrefixFromPath(pathname || '');
        const defaultLoginPath = `${localePrefix}/login` || '/login';
        const defaultProfilePath = `${localePrefix}/profile` || '/profile';
        const defaultVerifyPath = `${localePrefix}/verify-email` || '/verify-email';

        const resolveState = (): RedirectState => {
            const stored = consumeGoogleAuthRedirectState();
            if (!stored) {
                return { action: 'login', returnPath: defaultLoginPath };
            }
            if (Date.now()-(stored.createdAt || 0) > 10*60*1000) {
                return { action: stored.action, returnPath: stored.returnPath || defaultLoginPath };
            }
            return { action: stored.action, returnPath: stored.returnPath || defaultLoginPath };
        };

        const run = async () => {
            const error = searchParams.get('error');
            const errorDescription = searchParams.get('error_description');
            const code = searchParams.get('code');
            const state = resolveState();

            if (error) {
                toast.error(errorDescription || error || t('googleAuthFailed'));
                router.replace(state.action === 'link' ? defaultProfilePath : defaultLoginPath);
                return
            }

            if (!code) {
                toast.error(t('googleCodeMissing'));
                router.replace(state.action === 'link' ? defaultProfilePath : defaultLoginPath);
                return
            }

            const redirectUri = typeof window !== 'undefined'
                ? `${window.location.origin}${pathname}`
                : undefined;

            try {
                if (state.action === 'link') {
                    setStatusText(t('googleLinkProcessing'));
                    await linkGoogle({ code, redirect_uri: redirectUri, platform: 'web' });
                    toast.success(t('googleLinkSuccess'));
                    router.replace(state.returnPath || defaultProfilePath);
                    return;
                }

                setStatusText(t('googleLoginProcessing'));
                const user = await loginWithGoogle({ code, redirect_uri: redirectUri, platform: 'web' });
                toast.success(
                    state.action === 'register'
                        ? t('registerSuccess')
                        : t('loginSuccess')
                );
                if (!user.email_verified) {
                    router.replace(defaultVerifyPath);
                    return;
                }
                router.replace(state.returnPath || '/');
            } catch (err: unknown) {
                const apiErr = err as { error?: string; error_type?: string };
                if (apiErr.error_type === 'link_required') {
                    toast.error(apiErr.error || t('googleLinkRequiredError'));
                    router.replace(defaultLoginPath);
                    return;
                }
                toast.error(apiErr.error || t('googleLoginError'));
                router.replace(state.action === 'link' ? defaultProfilePath : defaultLoginPath);
            }
        };

        void run();
    }, [linkGoogle, loginWithGoogle, pathname, router, searchParams, t]);

    return (
        <div className="min-h-app flex items-center justify-center px-4 py-10">
            <Card className="w-full max-w-md">
                <CardHeader>
                    <CardTitle>{t('googleCallbackTitle')}</CardTitle>
                    <CardDescription>{statusText}</CardDescription>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                    {t('googleCallbackHint')}
                </CardContent>
            </Card>
        </div>
    );
}
