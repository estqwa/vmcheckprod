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
import type { User, MobileAuthResponse } from '@trivia/shared';

interface LoginData {
    email: string;
    password: string;
}

interface RegisterData {
    username: string;
    email: string;
    password: string;
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

/**
 * Получить текущего пользователя (общий endpoint).
 */
export async function getCurrentUser(): Promise<User> {
    return api.get<User>('/api/users/me');
}

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
    await api.put('/api/users/me', data);
}

/**
 * Проверить аутентификацию — попробовать получить пользователя.
 * Используется при запуске приложения.
 */
export async function checkAuth(): Promise<User | null> {
    try {
        const token = await getAccessToken();
        if (!token) {
            // РџРѕСЃР»Рµ РїРµСЂРµР·Р°РїСѓСЃРєР° app access token РјРѕР¶РµС‚ Р±С‹С‚СЊ РЅРµРґРѕСЃС‚СѓРїРµРЅ, РЅРѕ refresh РµС‰С‘ РІР°Р»РёРґРµРЅ.
            const refreshed = await refreshTokens();
            if (!refreshed) return null;
        }
        return await getCurrentUser();
    } catch {
        return null;
    }
}
