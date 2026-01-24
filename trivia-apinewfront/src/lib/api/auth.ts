import { api, setCsrfToken, getCsrfToken } from './client';
import { User, AuthResponse, Session } from './types';

interface RegisterData {
    username: string;
    email: string;
    password: string;
}

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

/**
 * Get CSRF token from server
 */
export async function fetchCsrfToken(): Promise<string> {
    const response = await api.get<{ csrf_token: string }>('/api/auth/csrf');
    setCsrfToken(response.csrf_token);
    return response.csrf_token;
}

/**
 * Get WebSocket ticket (required for WS connection)
 */
export async function getWsTicket(): Promise<string> {
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
