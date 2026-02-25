'use client';

export type GoogleAuthRedirectAction = 'login' | 'register' | 'link';

export type GoogleAuthRedirectState = {
    action: GoogleAuthRedirectAction;
    returnPath: string;
    createdAt: number;
};

const STORAGE_KEY = 'google_auth_redirect_state_v1';

export function buildGoogleCallbackPath(pathname: string): string {
    const segments = pathname.split('/').filter(Boolean);
    const locale = segments[0];
    if (!locale) {
        return '/auth/google/callback';
    }
    return `/${locale}/auth/google/callback`;
}

export function saveGoogleAuthRedirectState(state: GoogleAuthRedirectState): void {
    if (typeof window === 'undefined') return;
    try {
        window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
        // ignore storage failures
    }
}

export function consumeGoogleAuthRedirectState(): GoogleAuthRedirectState | null {
    if (typeof window === 'undefined') return null;
    try {
        const raw = window.sessionStorage.getItem(STORAGE_KEY);
        window.sessionStorage.removeItem(STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as Partial<GoogleAuthRedirectState>;
        if (!parsed || typeof parsed !== 'object') return null;
        if (parsed.action !== 'login' && parsed.action !== 'register' && parsed.action !== 'link') return null;
        const returnPath = typeof parsed.returnPath === 'string' && parsed.returnPath.startsWith('/')
            ? parsed.returnPath
            : '/';
        const createdAt = typeof parsed.createdAt === 'number' ? parsed.createdAt : Date.now();
        return { action: parsed.action, returnPath, createdAt };
    } catch {
        return null;
    }
}
