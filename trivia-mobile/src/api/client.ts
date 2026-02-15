// =============================================================================
// @trivia/mobile — API Client
// Bearer-based HTTP client с auto-refresh interceptor
// Аналог web client.ts, но без cookies/CSRF
// =============================================================================

import { API_URL } from '../constants/config';
import { getAccessToken, refreshTokens } from '../services/tokenService';
import type { ApiError } from '@trivia/shared';

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

    // Add body
    if (body && ['POST', 'PUT', 'PATCH'].includes(method)) {
        config.body = JSON.stringify(body);
    }

    // Add query params
    if (options.query) {
        const params = new URLSearchParams(options.query).toString();
        if (params) url += `?${params}`;
    }

    try {
        let response = await fetch(url, config);

        // Handle 401 — try auto-refresh
        if (response.status === 401 && !options.skipAuth) {
            const errorData = await response.json().catch(() => ({}));
            if (errorData.error_type === 'token_expired') {
                const newTokens = await refreshTokens();
                if (newTokens) {
                    // Retry with new token
                    headers['Authorization'] = `Bearer ${newTokens.accessToken}`;
                    response = await fetch(url, { ...config, headers });
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
            } catch {
                // Keep default error
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
        console.error(`[API] ${method} ${endpoint} failed:`, error);
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

    delete: <T>(endpoint: string, options?: RequestOptions) =>
        request<T>('DELETE', endpoint, undefined, options),

    patch: <T, B = unknown>(endpoint: string, body?: B, options?: RequestOptions) =>
        request<T, B>('PATCH', endpoint, body, options),
};
