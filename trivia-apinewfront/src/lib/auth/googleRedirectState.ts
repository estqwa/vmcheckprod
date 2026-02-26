'use client';

export type GoogleAuthRedirectAction = 'login' | 'register' | 'link';

export type GoogleAuthRedirectState = {
    action: GoogleAuthRedirectAction;
    returnPath: string;
    createdAt: number;
};

const STORAGE_KEY = 'google_auth_redirect_state_v1';
const SUPPORTED_LOCALES = new Set(['ru', 'kk']);

export function getLocalePrefixFromPath(pathname: string): string {
    const segments = pathname.split('/').filter(Boolean);
    const maybeLocale = segments[0];
    if (!maybeLocale || !SUPPORTED_LOCALES.has(maybeLocale)) {
        return '';
    }
    return `/${maybeLocale}`;
}

export function buildGoogleCallbackPath(pathname: string): string {
    const localePrefix = getLocalePrefixFromPath(pathname);
    return `${localePrefix}/auth/google/callback`;
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
