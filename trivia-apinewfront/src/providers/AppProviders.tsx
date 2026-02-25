'use client';

import { ReactNode } from 'react';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { QueryProvider } from './QueryProvider';
import { AuthProvider } from './AuthProvider';

type Props = {
    children: ReactNode;
};

export function AppProviders({ children }: Props) {
    const googleClientId = (process.env.NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID || '').trim();
    const googleEnabled = process.env.NEXT_PUBLIC_GOOGLE_OAUTH_ENABLED !== 'false' && googleClientId !== '';

    const content = (
        <QueryProvider>
            <AuthProvider>
                {children}
            </AuthProvider>
        </QueryProvider>
    );

    if (!googleEnabled) {
        return content;
    }

    return (
        <GoogleOAuthProvider clientId={googleClientId}>
            {content}
        </GoogleOAuthProvider>
    );
}

