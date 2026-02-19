// =============================================================================
// @trivia/mobile — Auth API
// Все запросы к /api/mobile/auth/* endpoints
// =============================================================================

import { api } from './client';
import {
    saveTokens,
    clearTokens,
    getRefreshToken,
    getDeviceId,
    getAccessToken,
    refreshTokens,
} from '../services/tokenService';
import type { User, Session, MobileAuthResponse } from '@trivia/shared';
import { getCurrentUser } from './user';

interface LoginData {
    email: string;
    password: string;
}

interface RegisterData {
    username: string;
    email: string;
    password: string;
}

interface SessionsResponse {
    sessions: Session[];
    count: number;
}

/**
 * Логин через mobile endpoint.
 * Возвращает user, сохраняет токены в SecureStore.
 */
export async function login(data: LoginData): Promise<User> {
    const deviceId = await getDeviceId();

    const response = await api.post<MobileAuthResponse>(
        '/api/mobile/auth/login',
        { ...data, device_id: deviceId },
        { skipAuth: true }
    );

    await saveTokens({
        accessToken: response.accessToken,
        refreshToken: response.refreshToken,
    });

    return response.user;
}

/**
 * Регистрация через mobile endpoint.
 */
export async function register(data: RegisterData): Promise<User> {
    const deviceId = await getDeviceId();

    const response = await api.post<MobileAuthResponse>(
        '/api/mobile/auth/register',
        { ...data, device_id: deviceId },
        { skipAuth: true }
    );

    await saveTokens({
        accessToken: response.accessToken,
        refreshToken: response.refreshToken,
    });

    return response.user;
}

/**
 * Логаут — отзывает refresh token на сервере, очищает локальные токены.
 */
export async function logout(): Promise<void> {
    try {
        const refreshToken = await getRefreshToken();
        if (refreshToken) {
            await api.post('/api/mobile/auth/logout', {
                refresh_token: refreshToken,
            });
        }
    } catch {
        // Even if server logout fails, clear local tokens
    } finally {
        await clearTokens();
    }
}

// getCurrentUser определён в user.ts — реэкспортируем для обратной совместимости
export { getCurrentUser } from './user';

/**
 * Получить WebSocket ticket через mobile endpoint.
 * Не требует CSRF, только Bearer auth.
 */
export async function getWsTicket(): Promise<string> {
    const response = await api.post<{ success: boolean; data: { ticket: string } }>(
        '/api/mobile/auth/ws-ticket',
        {}
    );
    return response.data.ticket;
}

/**
 * Обновить профиль пользователя.
 */
export async function updateProfile(data: { username?: string; profile_picture?: string }): Promise<void> {
    await api.put('/api/mobile/auth/profile', data);
}

/**
 * Получить активные сессии пользователя.
 */
export async function getActiveSessions(): Promise<Session[]> {
    const response = await api.get<SessionsResponse>('/api/mobile/auth/sessions');
    return response.sessions ?? [];
}

/**
 * Отозвать конкретную сессию по ID.
 */
export async function revokeSession(sessionId: number): Promise<void> {
    await api.post('/api/mobile/auth/revoke-session', { session_id: sessionId });
}

/**
 * Выйти со всех устройств.
 */
export async function logoutAllDevices(): Promise<void> {
    await api.post('/api/mobile/auth/logout-all', {});
}

/**
 * Проверить аутентификацию — попробовать получить пользователя.
 * Используется при запуске приложения.
 */
export async function checkAuth(): Promise<User | null> {
    try {
        const token = await getAccessToken();
        if (!token) {
            // После перезапуска app access token может быть недоступен, но refresh ещё валиден.
            const refreshed = await refreshTokens();
            if (!refreshed) return null;
        }
        return await getCurrentUser();
    } catch {
        return null;
    }
}
