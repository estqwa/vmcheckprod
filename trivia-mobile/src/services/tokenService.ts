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
let secureStoreAvailablePromise: Promise<boolean> | null = null;
const refreshTimeoutMs = 15_000;
const fallbackStore = new Map<string, string>();

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

function getWebStorage(): Storage | null {
    if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage;
    }
    if (typeof globalThis !== 'undefined' && 'localStorage' in globalThis) {
        const storage = (globalThis as { localStorage?: Storage }).localStorage;
        return storage ?? null;
    }
    return null;
}

function readFallbackValue(key: string): string | null {
    const webStorage = getWebStorage();
    if (webStorage) {
        try {
            return webStorage.getItem(key);
        } catch {
            return fallbackStore.get(key) ?? null;
        }
    }
    return fallbackStore.get(key) ?? null;
}

function saveFallbackValue(key: string, value: string): void {
    const webStorage = getWebStorage();
    if (webStorage) {
        try {
            webStorage.setItem(key, value);
        } catch {
            fallbackStore.set(key, value);
        }
        return;
    }
    fallbackStore.set(key, value);
}

function deleteFallbackValue(key: string): void {
    const webStorage = getWebStorage();
    if (webStorage) {
        try {
            webStorage.removeItem(key);
        } catch {
            fallbackStore.delete(key);
        }
        return;
    }
    fallbackStore.delete(key);
}

async function isSecureStoreAvailable(): Promise<boolean> {
    if (Platform.OS === 'web') return false;
    if (!secureStoreAvailablePromise) {
        secureStoreAvailablePromise = (async () => {
            if (typeof SecureStore.isAvailableAsync !== 'function') {
                return true;
            }
            try {
                return await SecureStore.isAvailableAsync();
            } catch {
                return false;
            }
        })();
    }
    return secureStoreAvailablePromise;
}

async function readStoredValue(key: string): Promise<string | null> {
    if (await isSecureStoreAvailable()) {
        try {
            return await SecureStore.getItemAsync(key);
        } catch {
            return readFallbackValue(key);
        }
    }
    return readFallbackValue(key);
}

async function saveStoredValue(key: string, value: string): Promise<void> {
    if (await isSecureStoreAvailable()) {
        try {
            await SecureStore.setItemAsync(key, value);
            return;
        } catch {
            saveFallbackValue(key, value);
            return;
        }
    }
    saveFallbackValue(key, value);
}

async function deleteStoredValue(key: string): Promise<void> {
    if (await isSecureStoreAvailable()) {
        try {
            await SecureStore.deleteItemAsync(key);
            return;
        } catch {
            deleteFallbackValue(key);
            return;
        }
    }
    deleteFallbackValue(key);
}

// ============ Device ID ============

/**
 * Получить или сгенерировать уникальный device_id.
 * Сохраняется в SecureStore, переживает переустановку на iOS.
 */
export async function getDeviceId(): Promise<string> {
    let deviceId = await readStoredValue(DEVICE_ID_KEY);
    if (!deviceId) {
        const randomUUID = globalThis.crypto?.randomUUID?.bind(globalThis.crypto);
        deviceId = randomUUID
            ? `${Platform.OS}-${randomUUID()}`
            : `${Platform.OS}-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
        await saveStoredValue(DEVICE_ID_KEY, deviceId);
    }
    return deviceId;
}

// ============ Token CRUD ============

export async function getAccessToken(): Promise<string | null> {
    if (accessTokenCache) return accessTokenCache;
    accessTokenCache = await readStoredValue(ACCESS_TOKEN_KEY);
    return accessTokenCache;
}

export async function getRefreshToken(): Promise<string | null> {
    return readStoredValue(REFRESH_TOKEN_KEY);
}

export async function saveTokens(tokens: TokenPair): Promise<void> {
    accessTokenCache = tokens.accessToken;
    await Promise.all([
        saveStoredValue(ACCESS_TOKEN_KEY, tokens.accessToken),
        saveStoredValue(REFRESH_TOKEN_KEY, tokens.refreshToken),
    ]);
}

export async function clearTokens(): Promise<void> {
    accessTokenCache = null;
    await Promise.all([
        deleteStoredValue(ACCESS_TOKEN_KEY),
        deleteStoredValue(REFRESH_TOKEN_KEY),
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
            const ctrl = new AbortController();
            const timeoutId = setTimeout(() => ctrl.abort(), refreshTimeoutMs);

            const response = await fetch(`${API_URL}/api/mobile/auth/refresh`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    refresh_token: currentRefresh,
                    device_id: deviceId,
                }),
                signal: ctrl.signal,
            }).finally(() => clearTimeout(timeoutId));

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
            const isAbortError =
                typeof error === 'object' &&
                error !== null &&
                'name' in error &&
                (error as { name: string }).name === 'AbortError';
            if (__DEV__) {
                if (isAbortError) {
                    console.warn(`[TokenService] Refresh timed out after ${refreshTimeoutMs}ms`);
                } else {
                    console.error('[TokenService] Refresh failed:', error);
                }
            }
            return null;
        } finally {
            refreshPromise = null;
        }
    })();

    return refreshPromise;
}
