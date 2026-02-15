// =============================================================================
// @trivia/mobile — Token Service
// Хранение токенов в SecureStore (Keychain/Keystore) + auto-refresh логика
// =============================================================================

import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import {
    ACCESS_TOKEN_KEY,
    REFRESH_TOKEN_KEY,
    DEVICE_ID_KEY,
    API_URL,
} from '../constants/config';

// In-memory cache for access token (fast reads, no async)
let accessTokenCache: string | null = null;
let refreshPromise: Promise<TokenPair | null> | null = null;

export interface TokenPair {
    accessToken: string;
    refreshToken: string;
}

type TokenResponseShape = {
    accessToken?: string;
    refreshToken?: string;
    access_token?: string;
    refresh_token?: string;
};

// ============ Device ID ============

/**
 * Получить или сгенерировать уникальный device_id.
 * Сохраняется в SecureStore, переживает переустановку на iOS.
 */
export async function getDeviceId(): Promise<string> {
    let deviceId = await SecureStore.getItemAsync(DEVICE_ID_KEY);
    if (!deviceId) {
        deviceId = `${Platform.OS}-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
        await SecureStore.setItemAsync(DEVICE_ID_KEY, deviceId);
    }
    return deviceId;
}

// ============ Token CRUD ============

export async function getAccessToken(): Promise<string | null> {
    if (accessTokenCache) return accessTokenCache;
    accessTokenCache = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
    return accessTokenCache;
}

export async function getRefreshToken(): Promise<string | null> {
    return SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
}

export async function saveTokens(tokens: TokenPair): Promise<void> {
    accessTokenCache = tokens.accessToken;
    await Promise.all([
        SecureStore.setItemAsync(ACCESS_TOKEN_KEY, tokens.accessToken),
        SecureStore.setItemAsync(REFRESH_TOKEN_KEY, tokens.refreshToken),
    ]);
}

export async function clearTokens(): Promise<void> {
    accessTokenCache = null;
    await Promise.all([
        SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
        SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
    ]);
}

// ============ Auto-Refresh ============

/**
 * Обновить токены через mobile refresh endpoint.
 * Дедупликация: если уже идёт refresh, вернёт тот же промис.
 */
export async function refreshTokens(): Promise<TokenPair | null> {
    if (refreshPromise) return refreshPromise;

    refreshPromise = (async () => {
        try {
            const currentRefresh = await getRefreshToken();
            if (!currentRefresh) return null;

            const deviceId = await getDeviceId();

            const response = await fetch(`${API_URL}/api/mobile/auth/refresh`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    refresh_token: currentRefresh,
                    device_id: deviceId,
                }),
            });

            if (!response.ok) {
                // Refresh token invalid/expired — clear everything
                if (response.status === 401) {
                    await clearTokens();
                }
                return null;
            }

            const data = (await response.json()) as TokenResponseShape;
            const accessToken = data.accessToken ?? data.access_token;
            const refreshToken = data.refreshToken ?? data.refresh_token;
            if (!accessToken || !refreshToken) {
                return null;
            }
            const newTokens: TokenPair = {
                accessToken,
                refreshToken,
            };
            await saveTokens(newTokens);
            return newTokens;
        } catch (error) {
            console.error('[TokenService] Refresh failed:', error);
            return null;
        } finally {
            refreshPromise = null;
        }
    })();

    return refreshPromise;
}
