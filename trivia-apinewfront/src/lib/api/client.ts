import { ApiError } from './types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
const CSRF_STORAGE_KEY = 'trivia.web.csrf-token';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

interface RequestOptions {
    headers?: Record<string, string>;
    query?: Record<string, string>;
}

// CSRF token hash storage: in-memory first, with localStorage fallback so refresh can survive tab reloads.
let csrfToken: string | null = null;
let refreshPromise: Promise<boolean> | null = null;

function readStoredCsrfToken(): string | null {
    if (typeof window === 'undefined') return null;

    try {
        return window.localStorage.getItem(CSRF_STORAGE_KEY);
    } catch {
        return null;
    }
}

function writeStoredCsrfToken(token: string | null) {
    if (typeof window === 'undefined') return;

    try {
        if (token) {
            window.localStorage.setItem(CSRF_STORAGE_KEY, token);
        } else {
            window.localStorage.removeItem(CSRF_STORAGE_KEY);
        }
    } catch {
        // Ignore storage failures and keep the in-memory token.
    }
}

export function setCsrfToken(token: string | null) {
    csrfToken = token;
    writeStoredCsrfToken(token);
}

export function getCsrfToken(): string | null {
    if (csrfToken) return csrfToken;

    const storedToken = readStoredCsrfToken();
    if (storedToken) {
        csrfToken = storedToken;
    }

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
    const currentCsrfToken = getCsrfToken();

    // Build headers
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...options.headers,
    };

    // Add CSRF token for mutating requests
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method) && currentCsrfToken) {
        headers['X-CSRF-Token'] = currentCsrfToken;
    }

    const config: RequestInit = {
        method,
        headers,
        credentials: 'include', // Important: sends HttpOnly cookies
    };

    // Add body for mutating requests (including DELETE for endpoints like account deletion)
    if (body && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
        if (body instanceof FormData) {
            config.body = body;
            // Let the browser set the Content-Type with the boundary for FormData
            delete headers['Content-Type'];
        } else {
            config.body = JSON.stringify(body);
        }
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
            const errorData = await response.json().catch(() => ({ error: response.statusText }));
            const shouldTryRefresh =
                endpoint !== '/api/auth/refresh' &&
                ['token_expired', 'token_missing', 'token_invalid'].includes(errorData.error_type);

            if (shouldTryRefresh) {
                // Try to refresh token
                const refreshed = await refreshTokens();
                if (refreshed) {
                    // Retry the original request
                    const refreshedCsrfToken = getCsrfToken();
                    if (refreshedCsrfToken) {
                        headers['X-CSRF-Token'] = refreshedCsrfToken;
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
    const currentCsrfToken = getCsrfToken();
    if (!currentCsrfToken) return false;
    if (refreshPromise) return refreshPromise;

    refreshPromise = (async () => {
        try {
            const response = await fetch(`${API_URL}/api/auth/refresh`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': currentCsrfToken,
                },
                credentials: 'include',
            });

            if (response.ok) {
                const data = await response.json();
                setCsrfToken(data.csrfToken);
                return true;
            }

            const errorData = await response.json().catch(() => ({}));
            if (
                response.status === 401 ||
                (response.status === 403 &&
                    typeof errorData.error_type === 'string' &&
                    errorData.error_type.startsWith('csrf_'))
            ) {
                setCsrfToken(null);
            }

            return false;
        } catch {
            return false;
        } finally {
            refreshPromise = null;
        }
    })();

    return refreshPromise;
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
