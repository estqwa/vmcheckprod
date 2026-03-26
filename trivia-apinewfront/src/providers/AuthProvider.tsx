'use client';

import { createContext, useContext, useState, useCallback, ReactNode, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
    RegisterData,
    User,
    EmailVerificationStatus,
    EmailVerificationConfirmData,
    GoogleExchangeRequestData,
    GoogleLinkRequestData,
    DeleteAccountRequestData,
} from '@/lib/api/types';
import {
    login as apiLogin,
    register as apiRegister,
    googleExchange as apiGoogleExchange,
    googleLink as apiGoogleLink,
    logout as apiLogout,
    deleteAccount as apiDeleteAccount,
    getEmailVerificationStatus as apiGetEmailVerificationStatus,
    sendEmailVerificationCode as apiSendEmailVerificationCode,
    confirmEmailVerificationCode as apiConfirmEmailVerificationCode,
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
    register: (data: RegisterData) => Promise<void>;
    loginWithGoogle: (data: GoogleExchangeRequestData) => Promise<User>;
    linkGoogle: (data: GoogleLinkRequestData) => Promise<User>;
    logout: () => Promise<void>;
    deleteAccount: (data?: DeleteAccountRequestData) => Promise<void>;
    getEmailVerificationStatus: () => Promise<EmailVerificationStatus>;
    sendEmailVerificationCode: () => Promise<void>;
    confirmEmailVerificationCode: (data: EmailVerificationConfirmData) => Promise<void>;
    clearError: () => void;
    getWsTicket: () => Promise<string>;
    updateProfile: (data: { username?: string; profile_picture?: string }) => Promise<void>;
    refetchUser: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const queryClient = useQueryClient();
    const csrfSyncedUserIdRef = useRef<number | null>(null);

    // РСЃРїРѕР»СЊР·СѓРµРј TanStack Query РґР»СЏ РґР°РЅРЅС‹С… РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ
    const { data: user, isLoading: isQueryLoading, refetch } = useUserQuery();

    // Р›РѕРєР°Р»СЊРЅРѕРµ СЃРѕСЃС‚РѕСЏРЅРёРµ РґР»СЏ РѕС€РёР±РѕРє Рё loading РїСЂРё login/register
    const [error, setError] = useState<string | null>(null);
    const [isAuthAction, setIsAuthAction] = useState(false);

    // РљРѕРјР±РёРЅРёСЂРѕРІР°РЅРЅС‹Р№ loading state
    const isLoading = isQueryLoading || isAuthAction;

    // Check if user is admin (based on role from backend)
    const isAdmin = user?.role === 'admin';
    const isAuthenticated = !!user;
    const csrfToken = getCsrfToken();

    useEffect(() => {
        if (!user?.id) {
            csrfSyncedUserIdRef.current = null;
            return;
        }

        if (csrfSyncedUserIdRef.current === user.id && csrfToken) {
            return;
        }

        fetchCsrfToken()
            .then(() => {
                csrfSyncedUserIdRef.current = user.id;
            })
            .catch(() => {
                // Ignore CSRF fetch errors
            });
    }, [user?.id, csrfToken]);

    const login = useCallback(async (email: string, password: string) => {
        setIsAuthAction(true);
        setError(null);
        try {
            const response = await apiLogin({ email, password });
            // РћР±РЅРѕРІР»СЏРµРј РєРµС€ TanStack Query СЃ РґР°РЅРЅС‹РјРё РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ
            queryClient.setQueryData(userQueryKey, response.user);
        } catch (err: unknown) {
            const error = err as { error?: string };
            setError(error.error || 'РћС€РёР±РєР° РІС…РѕРґР°');
            throw err;
        } finally {
            setIsAuthAction(false);
        }
    }, [queryClient]);

    const register = useCallback(async (data: RegisterData) => {
        setIsAuthAction(true);
        setError(null);
        try {
            const response = await apiRegister(data);
            // РћР±РЅРѕРІР»СЏРµРј РєРµС€ TanStack Query СЃ РґР°РЅРЅС‹РјРё РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ
            queryClient.setQueryData(userQueryKey, response.user);
        } catch (err: unknown) {
            const error = err as { error?: string };
            setError(error.error || 'РћС€РёР±РєР° СЂРµРіРёСЃС‚СЂР°С†РёРё');
            throw err;
        } finally {
            setIsAuthAction(false);
        }
    }, [queryClient]);

    const loginWithGoogle = useCallback(async (data: GoogleExchangeRequestData): Promise<User> => {
        setIsAuthAction(true);
        setError(null);
        try {
            const response = await apiGoogleExchange(data);
            queryClient.setQueryData(userQueryKey, response.user);
            return response.user;
        } catch (err: unknown) {
            const apiErr = err as { error?: string };
            setError(apiErr.error || 'РћС€РёР±РєР° РІС…РѕРґР° С‡РµСЂРµР· Google');
            throw err;
        } finally {
            setIsAuthAction(false);
        }
    }, [queryClient]);

    const linkGoogle = useCallback(async (data: GoogleLinkRequestData): Promise<User> => {
        setIsAuthAction(true);
        setError(null);
        try {
            const response = await apiGoogleLink(data);
            queryClient.setQueryData(userQueryKey, response.user);
            return response.user;
        } catch (err: unknown) {
            const apiErr = err as { error?: string };
            setError(apiErr.error || 'РћС€РёР±РєР° РїСЂРёРІСЏР·РєРё Google');
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
            // РћС‡РёС‰Р°РµРј РєРµС€ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ
            queryClient.setQueryData(userQueryKey, null);
            queryClient.removeQueries({ queryKey: userQueryKey });
            setIsAuthAction(false);
        }
    }, [queryClient]);

    const deleteAccount = useCallback(async (data?: DeleteAccountRequestData) => {
        setIsAuthAction(true);
        try {
            await apiDeleteAccount(data);
            queryClient.setQueryData(userQueryKey, null);
            queryClient.removeQueries({ queryKey: userQueryKey });
        } finally {
            setIsAuthAction(false);
        }
    }, [queryClient]);

    const getEmailVerificationStatus = useCallback(async (): Promise<EmailVerificationStatus> => {
        return apiGetEmailVerificationStatus();
    }, []);

    const sendEmailVerificationCode = useCallback(async () => {
        await apiSendEmailVerificationCode();
    }, []);

    const confirmEmailVerificationCode = useCallback(async (data: EmailVerificationConfirmData) => {
        await apiConfirmEmailVerificationCode(data);
        await refetch();
    }, [refetch]);

    const clearError = useCallback(() => {
        setError(null);
    }, []);

    const getWsTicket = useCallback(async (): Promise<string> => {
        return apiGetWsTicket();
    }, []);

    const updateProfile = useCallback(async (data: { username?: string; profile_picture?: string }) => {
        await apiUpdateProfile(data);
        // РћР±РЅРѕРІР»СЏРµРј Р»РѕРєР°Р»СЊРЅС‹Р№ РєРµС€ СЃ РЅРѕРІС‹РјРё РґР°РЅРЅС‹РјРё РїСЂРѕС„РёР»СЏ
        if (user) {
            queryClient.setQueryData(userQueryKey, {
                ...user,
                username: data.username ?? user.username,
                profile_picture: data.profile_picture ?? user.profile_picture,
            });
        }
    }, [user, queryClient]);

    // Р¤СѓРЅРєС†РёСЏ РґР»СЏ СЂСѓС‡РЅРѕР№ СЂРµРІР°Р»РёРґР°С†РёРё РґР°РЅРЅС‹С… РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ
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
        loginWithGoogle,
        linkGoogle,
        logout,
        deleteAccount,
        getEmailVerificationStatus,
        sendEmailVerificationCode,
        confirmEmailVerificationCode,
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

