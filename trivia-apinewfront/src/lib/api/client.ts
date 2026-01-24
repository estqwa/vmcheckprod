import { ApiError } from './types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

interface RequestOptions {
    headers?: Record<string, string>;
    query?: Record<string, string>;
}

// CSRF token storage (in-memory, not localStorage for security)
let csrfToken: string | null = null;

export function setCsrfToken(token: string | null) {
    csrfToken = token;
}

export function getCsrfToken(): string | null {
    return csrfToken;
}

/**
 * Makes an HTTP request to the API
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

    // Add CSRF token for mutating requests
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method) && csrfToken) {
        headers['X-CSRF-Token'] = csrfToken;
    }

    const config: RequestInit = {
        method,
        headers,
        credentials: 'include', // Important: sends HttpOnly cookies
    };

    // Add body for mutating requests
    if (body && ['POST', 'PUT', 'PATCH'].includes(method)) {
        config.body = JSON.stringify(body);
    }

    // Add query params
    if (options.query) {
        const params = new URLSearchParams(options.query).toString();
        if (params) {
            url += `?${params}`;
        }
    }

    try {
        const response = await fetch(url, config);

        // Handle 401 with token_expired - trigger refresh
        if (response.status === 401) {
            const errorData = await response.json();
            if (errorData.error_type === 'token_expired') {
                // Try to refresh token
                const refreshed = await refreshTokens();
                if (refreshed) {
                    // Retry the original request
                    if (csrfToken) {
                        headers['X-CSRF-Token'] = csrfToken;
                    }
                    const retryResponse = await fetch(url, { ...config, headers });
                    if (retryResponse.ok) {
                        if (retryResponse.status === 204) return undefined as T;
                        return retryResponse.json();
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
        console.error(`API request failed: ${method} ${url}`, error);
        throw error;
    }
}

/**
 * Refresh access token using refresh cookie
 */
async function refreshTokens(): Promise<boolean> {
    if (!csrfToken) return false;

    try {
        const response = await fetch(`${API_URL}/api/auth/refresh`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-Token': csrfToken,
            },
            credentials: 'include',
        });

        if (response.ok) {
            const data = await response.json();
            setCsrfToken(data.csrfToken);
            return true;
        }
        return false;
    } catch {
        return false;
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
