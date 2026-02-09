'use client';

import { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { User } from '@/lib/api/types';
import {
    login as apiLogin,
    register as apiRegister,
    logout as apiLogout,
    fetchCsrfToken,
    getWsTicket as apiGetWsTicket,
    updateProfile as apiUpdateProfile,
} from '@/lib/api/auth';
import { getCsrfToken } from '@/lib/api/client';
import { useUserQuery, userQueryKey } from '@/lib/hooks/useUserQuery';

interface AuthContextType {
    user: User | null;
    isLoading: boolean;
    isAuthenticated: boolean;
    isAdmin: boolean;
    csrfToken: string | null;
    error: string | null;
    login: (email: string, password: string) => Promise<void>;
    register: (username: string, email: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
    clearError: () => void;
    getWsTicket: () => Promise<string>;
    updateProfile: (data: { username?: string; profile_picture?: string }) => Promise<void>;
    refetchUser: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const queryClient = useQueryClient();

    // Используем TanStack Query для данных пользователя
    const { data: user, isLoading: isQueryLoading, refetch } = useUserQuery();

    // Локальное состояние для ошибок и loading при login/register
    const [error, setError] = useState<string | null>(null);
    const [isAuthAction, setIsAuthAction] = useState(false);

    // Комбинированный loading state
    const isLoading = isQueryLoading || isAuthAction;

    // Check if user is admin (based on role from backend)
    const isAdmin = user?.role === 'admin';
    const isAuthenticated = !!user;
    const csrfToken = getCsrfToken();

    // Fetch CSRF token при наличии пользователя
    useEffect(() => {
        if (user) {
            fetchCsrfToken().catch(() => {
                // Ignore CSRF fetch errors
            });
        }
    }, [user]);

    const login = useCallback(async (email: string, password: string) => {
        setIsAuthAction(true);
        setError(null);
        try {
            const response = await apiLogin({ email, password });
            // Обновляем кеш TanStack Query с данными пользователя
            queryClient.setQueryData(userQueryKey, response.user);
        } catch (err: unknown) {
            const error = err as { error?: string };
            setError(error.error || 'Ошибка входа');
            throw err;
        } finally {
            setIsAuthAction(false);
        }
    }, [queryClient]);

    const register = useCallback(async (username: string, email: string, password: string) => {
        setIsAuthAction(true);
        setError(null);
        try {
            const response = await apiRegister({ username, email, password });
            // Обновляем кеш TanStack Query с данными пользователя
            queryClient.setQueryData(userQueryKey, response.user);
        } catch (err: unknown) {
            const error = err as { error?: string };
            setError(error.error || 'Ошибка регистрации');
            throw err;
        } finally {
            setIsAuthAction(false);
        }
    }, [queryClient]);

    const logout = useCallback(async () => {
        setIsAuthAction(true);
        try {
            await apiLogout();
        } catch {
            // Even if logout fails on server, clear local state
        } finally {
            // Очищаем кеш пользователя
            queryClient.setQueryData(userQueryKey, null);
            queryClient.removeQueries({ queryKey: userQueryKey });
            setIsAuthAction(false);
        }
    }, [queryClient]);

    const clearError = useCallback(() => {
        setError(null);
    }, []);

    const getWsTicket = useCallback(async (): Promise<string> => {
        if (!isAuthenticated) {
            throw new Error('Not authenticated');
        }
        return apiGetWsTicket();
    }, [isAuthenticated]);

    const updateProfile = useCallback(async (data: { username?: string; profile_picture?: string }) => {
        await apiUpdateProfile(data);
        // Обновляем локальный кеш с новыми данными профиля
        if (user) {
            queryClient.setQueryData(userQueryKey, {
                ...user,
                username: data.username ?? user.username,
                profile_picture: data.profile_picture ?? user.profile_picture,
            });
        }
    }, [user, queryClient]);

    // Функция для ручной ревалидации данных пользователя
    const refetchUser = useCallback(() => {
        refetch();
    }, [refetch]);

    const value: AuthContextType = {
        user: user ?? null,
        isLoading,
        isAuthenticated,
        isAdmin,
        csrfToken,
        error,
        login,
        register,
        logout,
        clearError,
        getWsTicket,
        updateProfile,
        refetchUser,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
