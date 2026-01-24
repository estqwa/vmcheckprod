'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { User } from '@/lib/api/types';
import {
    login as apiLogin,
    register as apiRegister,
    logout as apiLogout,
    getCurrentUser,
    fetchCsrfToken,
    getWsTicket as apiGetWsTicket,
    updateProfile as apiUpdateProfile,
} from '@/lib/api/auth';
import { getCsrfToken } from '@/lib/api/client';

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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Check if user is admin (user.id === 1)
    const isAdmin = user?.id === 1;
    const isAuthenticated = !!user;
    const csrfToken = getCsrfToken();

    // Initial auth check
    useEffect(() => {
        const initAuth = async () => {
            try {
                const userData = await getCurrentUser();
                setUser(userData);
                await fetchCsrfToken();
            } catch {
                setUser(null);
            } finally {
                setIsLoading(false);
            }
        };

        initAuth();
    }, []);

    const login = useCallback(async (email: string, password: string) => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await apiLogin({ email, password });
            setUser(response.user);
        } catch (err: unknown) {
            const error = err as { error?: string };
            setError(error.error || 'Ошибка входа');
            throw err;
        } finally {
            setIsLoading(false);
        }
    }, []);

    const register = useCallback(async (username: string, email: string, password: string) => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await apiRegister({ username, email, password });
            setUser(response.user);
        } catch (err: unknown) {
            const error = err as { error?: string };
            setError(error.error || 'Ошибка регистрации');
            throw err;
        } finally {
            setIsLoading(false);
        }
    }, []);

    const logout = useCallback(async () => {
        setIsLoading(true);
        try {
            await apiLogout();
        } catch {
            // Even if logout fails on server, clear local state
        } finally {
            setUser(null);
            setIsLoading(false);
        }
    }, []);

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
        // Update local user state
        if (user) {
            setUser({
                ...user,
                username: data.username ?? user.username,
                profile_picture: data.profile_picture ?? user.profile_picture,
            });
        }
    }, [user]);

    const value: AuthContextType = {
        user,
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
