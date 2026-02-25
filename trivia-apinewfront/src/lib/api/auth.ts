import { api, setCsrfToken, getCsrfToken } from './client';
import {
    User,
    AuthResponse,
    Session,
    RegisterData,
    MessageResponse,
    EmailVerificationStatus,
    EmailVerificationConfirmData,
    GoogleExchangeRequestData,
    GoogleLinkRequestData,
    GoogleLinkResponse,
    DeleteAccountRequestData,
} from './types';

// Lock to prevent multiple simultaneous CSRF fetch requests
let csrfFetchPromise: Promise<string> | null = null;



interface LoginData {
    email: string;
    password: string;
    device_id?: string;
}

/**
 * Register a new user
 */
export async function register(data: RegisterData): Promise<AuthResponse> {
    const response = await api.post<AuthResponse>('/api/auth/register', data);
    setCsrfToken(response.csrfToken);
    return response;
}

/**
 * Login user
 */
export async function login(data: LoginData): Promise<AuthResponse> {
    const response = await api.post<AuthResponse>('/api/auth/login', data);
    setCsrfToken(response.csrfToken);
    return response;
}

/**
 * Login / register with Google via backend exchange endpoint.
 */
export async function googleExchange(data: GoogleExchangeRequestData): Promise<AuthResponse> {
    const response = await api.post<AuthResponse, GoogleExchangeRequestData>('/api/auth/google/exchange', data);
    setCsrfToken(response.csrfToken);
    return response;
}

/**
 * Explicitly link Google identity to current account.
 */
export async function googleLink(data: GoogleLinkRequestData): Promise<GoogleLinkResponse> {
    return api.post<GoogleLinkResponse, GoogleLinkRequestData>('/api/auth/google/link', data);
}

/**
 * Logout current session
 */
export async function logout(): Promise<void> {
    await api.post('/api/auth/logout');
    setCsrfToken(null);
}

/**
 * Logout from all devices
 */
export async function logoutAll(): Promise<void> {
    await api.post('/api/auth/logout-all');
    setCsrfToken(null);
}

/**
 * Refresh tokens
 */
export async function refreshTokens(): Promise<{ csrfToken: string }> {
    const csrfToken = getCsrfToken();

    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/refresh`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(csrfToken && { 'X-CSRF-Token': csrfToken }),
        },
        credentials: 'include',
    });

    if (!response.ok) {
        throw new Error('Failed to refresh tokens');
    }

    const data = await response.json();
    setCsrfToken(data.csrfToken);
    return data;
}

/**
 * Get current authenticated user
 */
export async function getCurrentUser(): Promise<User> {
    return api.get<User>('/api/users/me');
}

export async function getEmailVerificationStatus(): Promise<EmailVerificationStatus> {
    return api.get<EmailVerificationStatus>('/api/auth/verify-email/status');
}

export async function sendEmailVerificationCode(): Promise<MessageResponse> {
    return api.post<MessageResponse>('/api/auth/verify-email/send', {});
}

export async function confirmEmailVerificationCode(data: EmailVerificationConfirmData): Promise<MessageResponse> {
    return api.post<MessageResponse, EmailVerificationConfirmData>('/api/auth/verify-email/confirm', data);
}

export async function deleteAccount(data?: DeleteAccountRequestData): Promise<MessageResponse> {
    return api.delete<MessageResponse, DeleteAccountRequestData>('/api/users/me', data ?? {});
}

/**
 * Get CSRF token from server (with deduplication)
 */
export async function fetchCsrfToken(): Promise<string> {
    // If there's already a fetch in progress, wait for it
    if (csrfFetchPromise) {
        return csrfFetchPromise;
    }

    csrfFetchPromise = (async () => {
        try {
            const response = await api.get<{ csrf_token: string }>('/api/auth/csrf');
            setCsrfToken(response.csrf_token);
            return response.csrf_token;
        } finally {
            csrfFetchPromise = null;
        }
    })();

    return csrfFetchPromise;
}

/**
 * Ensure CSRF token is available (fetch if missing)
 */
async function ensureCsrfToken(): Promise<string> {
    const existing = getCsrfToken();
    if (existing) {
        return existing;
    }
    return fetchCsrfToken();
}

/**
 * Get WebSocket ticket (required for WS connection)
 * Ensures CSRF token is available before making the request
 */
export async function getWsTicket(): Promise<string> {
    // Ensure CSRF token is available before making the POST request
    await ensureCsrfToken();
    const response = await api.post<{ success: boolean; data: { ticket: string } }>('/api/auth/ws-ticket', {});
    return response.data.ticket;
}

/**
 * Get active sessions
 */
export async function getSessions(): Promise<{ sessions: Session[]; count: number }> {
    return api.get('/api/auth/sessions');
}

/**
 * Revoke a specific session
 */
export async function revokeSession(sessionId: number, reason?: string): Promise<void> {
    await api.post('/api/auth/revoke-session', { session_id: sessionId }, {
        query: reason ? { reason } : undefined,
    });
}

/**
 * Change password
 */
export async function changePassword(oldPassword: string, newPassword: string): Promise<void> {
    await api.post('/api/auth/change-password', {
        old_password: oldPassword,
        new_password: newPassword,
    });
}

/**
 * Update user profile
 */
export async function updateProfile(data: { username?: string; profile_picture?: string }): Promise<void> {
    await api.put('/api/users/me', data);
}

/**
 * Check if user is authenticated (by trying to get current user)
 */
export async function checkAuth(): Promise<{ user: User; csrfToken: string } | null> {
    try {
        const user = await getCurrentUser();
        const csrfToken = await fetchCsrfToken();
        return { user, csrfToken };
    } catch {
        return null;
    }
}
