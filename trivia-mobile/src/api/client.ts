// =============================================================================
// @trivia/mobile — API Client
// Bearer-based HTTP client с auto-refresh interceptor
// Аналог web client.ts, но без cookies/CSRF
// =============================================================================

import { API_URL } from '../constants/config';
import NetInfo from '@react-native-community/netinfo';
import { getAccessToken, refreshTokens } from '../services/tokenService';
import type { ApiError } from '@trivia/shared';

const REQUEST_TIMEOUT_MS = 15_000;

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

interface RequestOptions {
    headers?: Record<string, string>;
    query?: Record<string, string>;
    /** Пропустить авторизацию (для login/register) */
    skipAuth?: boolean;
}

/**
 * HTTP-запрос к API с Bearer авторизацией и auto-refresh.
 */
export async function request<T, B = unknown>(
    method: HttpMethod,
    endpoint: string,
    body?: B,
    options: RequestOptions = {}
): Promise<T> {
    let url = `${API_URL}${endpoint}`;

    const networkState = await NetInfo.fetch();
    const isOffline = networkState.isConnected === false || networkState.isInternetReachable === false;
    if (isOffline) {
        throw { error: 'No internet connection', error_type: 'offline', status: 0 } as ApiError & { status: number };
    }

    // Build headers
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...options.headers,
    };

    // Add Bearer token (если не skipAuth)
    if (!options.skipAuth) {
        const token = await getAccessToken();
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
    }

    const config: RequestInit = {
        method,
        headers,
    };

    // Add body (DELETE is also used for account deletion with confirmation payload)
    if (body && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
        config.body = JSON.stringify(body);
    }

    // Add query params
    if (options.query) {
        const params = new URLSearchParams(options.query).toString();
        if (params) url += `?${params}`;
    }

    // Helper: fetch с собственным AbortController и таймаутом
    function fetchWithTimeout(fetchUrl: string, fetchConfig: RequestInit): Promise<Response> {
        const ctrl = new AbortController();
        const tid = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
        return fetch(fetchUrl, { ...fetchConfig, signal: ctrl.signal }).finally(() => clearTimeout(tid));
    }

    try {
        let response = await fetchWithTimeout(url, config);

        // Handle 401 — try auto-refresh
        if (response.status === 401 && !options.skipAuth) {
            const errorData = await response.json().catch(() => ({}));
            if (errorData.error_type === 'token_expired') {
                const newTokens = await refreshTokens();
                if (newTokens) {
                    // Retry with new token — fresh controller, full timeout
                    headers['Authorization'] = `Bearer ${newTokens.accessToken}`;
                    response = await fetchWithTimeout(url, { ...config, headers });
                    if (response.ok) {
                        if (response.status === 204) return undefined as T;
                        return response.json();
                    }
                }
            }
            throw { error: errorData.error, error_type: errorData.error_type, status: 401 } as ApiError & { status: number };
        }

        if (!response.ok) {
            let errorData: ApiError = { error: response.statusText };
            try {
                errorData = await response.json();
            } catch (parseErr) {
                if (__DEV__) console.warn('[API] Failed to parse error response:', parseErr);
            }
            throw { ...errorData, status: response.status };
        }

        // Handle empty response
        if (response.status === 204 || response.headers.get('Content-Length') === '0') {
            return undefined as T;
        }

        // Parse JSON
        if (response.headers.get('Content-Type')?.includes('application/json')) {
            return response.json();
        }

        return response.text() as unknown as T;
    } catch (error) {
        if (__DEV__) {
            const isAbort = typeof error === 'object' && error !== null && 'name' in error && (error as { name: string }).name === 'AbortError';
            if (isAbort) {
                console.warn(`[API] ${method} ${endpoint} timed out after ${REQUEST_TIMEOUT_MS}ms`);
            } else {
                console.error(`[API] ${method} ${endpoint} failed:`, error);
            }
        }
        throw error;
    }
}

// Convenience methods
export const api = {
    get: <T>(endpoint: string, options?: RequestOptions) =>
        request<T>('GET', endpoint, undefined, options),

    post: <T, B = unknown>(endpoint: string, body?: B, options?: RequestOptions) =>
        request<T, B>('POST', endpoint, body, options),

    put: <T, B = unknown>(endpoint: string, body?: B, options?: RequestOptions) =>
        request<T, B>('PUT', endpoint, body, options),

    delete: <T, B = unknown>(endpoint: string, body?: B, options?: RequestOptions) =>
        request<T, B>('DELETE', endpoint, body, options),

    patch: <T, B = unknown>(endpoint: string, body?: B, options?: RequestOptions) =>
        request<T, B>('PATCH', endpoint, body, options),
};
