'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useGoogleLogin } from '@react-oauth/google';
import { Button } from '@/components/ui/button';
import {
    buildGoogleCallbackPath,
    saveGoogleAuthRedirectState,
    type GoogleAuthRedirectAction,
} from '@/lib/auth/googleRedirectState';

type GoogleCodeAuthButtonProps = {
    label: string;
    action: GoogleAuthRedirectAction;
    disabled?: boolean;
    className?: string;
    returnPath?: string;
    onError?: (message: string) => void;
};

export function GoogleCodeAuthButton({
    label,
    action,
    disabled = false,
    className,
    returnPath,
    onError,
}: GoogleCodeAuthButtonProps) {
    const googleClientEnabled = useMemo(
        () => (process.env.NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID || '').trim() !== '' &&
            process.env.NEXT_PUBLIC_GOOGLE_OAUTH_ENABLED !== 'false',
        []
    );

    if (!googleClientEnabled) {
        return null;
    }

    return (
        <GoogleCodeAuthButtonInner
            label={label}
            action={action}
            disabled={disabled}
            className={className}
            returnPath={returnPath}
            onError={onError}
        />
    );
}

function GoogleCodeAuthButtonInner({
    label,
    action,
    disabled = false,
    className,
    returnPath,
    onError,
}: GoogleCodeAuthButtonProps) {
    const pathname = usePathname();
    const [redirectUri, setRedirectUri] = useState<string>('');
    const [isPending, setIsPending] = useState(false);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const callbackPath = buildGoogleCallbackPath(window.location.pathname);
        setRedirectUri(`${window.location.origin}${callbackPath}`);
    }, [pathname]);

    const login = useGoogleLogin({
        flow: 'auth-code',
        ux_mode: 'redirect',
        redirect_uri: redirectUri || undefined,
        scope: 'openid email profile',
        onSuccess: () => {},
        onError: (err) => {
            onError?.(err.error_description || err.error || 'Google login failed');
        },
        onNonOAuthError: (err) => {
            onError?.(typeof err === 'string' ? err : 'Google login popup failed');
        },
    });

    return (
        <Button
            type="button"
            variant="outline"
            className={className}
            disabled={disabled || isPending || !redirectUri}
            onClick={() => {
                if (!redirectUri) {
                    onError?.('Google redirect URI is not ready');
                    return;
                }
                setIsPending(true);
                saveGoogleAuthRedirectState({
                    action,
                    returnPath: returnPath || pathname || '/',
                    createdAt: Date.now(),
                });
                login();
            }}
        >
            {isPending ? 'Google...' : label}
        </Button>
    );
}
