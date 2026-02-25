import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter, useSegments } from 'expo-router';
import type { RegisterData, Session, User } from '@trivia/shared';
import type {
  EmailVerificationStatus,
  EmailVerificationConfirmData,
  GoogleExchangeRequestData,
  GoogleLinkRequestData,
  DeleteAccountRequestData,
} from '@trivia/shared';
import {
  login as authLogin,
  register as authRegister,
  googleExchange as authGoogleExchange,
  googleLink as authGoogleLink,
  logout as authLogout,
  logoutAllDevices as authLogoutAllDevices,
  deleteAccount as authDeleteAccount,
  getEmailVerificationStatus as authGetEmailVerificationStatus,
  sendEmailVerificationCode as authSendEmailVerificationCode,
  confirmEmailVerificationCode as authConfirmEmailVerificationCode,
  checkAuth,
  getWsTicket as authGetWsTicket,
  getActiveSessions as authGetActiveSessions,
  revokeSession as authRevokeSession,
  updateProfile as authUpdateProfile,
} from '../api/auth';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
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
  getActiveSessions: () => Promise<Session[]>;
  revokeSession: (sessionId: number) => Promise<void>;
  logoutAllDevices: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const segments = useSegments();

  const [user, setUser] = useState<User | null>(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [isAuthPending, setIsAuthPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isAuthenticated = !!user;
  const isLoading = isBootstrapping || isAuthPending;

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const currentUser = await checkAuth();
        if (!mounted) return;
        setUser(currentUser);
      } catch {
        if (!mounted) return;
        setUser(null);
      } finally {
        if (mounted) setIsBootstrapping(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (isBootstrapping) return;

    const inAuthGroup = segments[0] === '(auth)';
    const isVerifyEmailScreen = String(segments[1] ?? '') === 'verify-email';

    if (!isAuthenticated && !inAuthGroup) {
      router.replace('/(auth)/login');
      return;
    }

    if (isAuthenticated && inAuthGroup) {
      if (isVerifyEmailScreen && !user?.email_verified) {
        return;
      }
      router.replace('/(tabs)');
    }
  }, [isAuthenticated, isBootstrapping, segments, router, user?.email_verified]);

  const login = useCallback(async (email: string, password: string) => {
    setError(null);
    setIsAuthPending(true);
    try {
      const loggedInUser = await authLogin({ email, password });
      setUser(loggedInUser);
    } catch (err: unknown) {
      const apiErr = err as { error?: string };
      setError(apiErr.error || 'Login failed');
      throw err;
    } finally {
      setIsAuthPending(false);
    }
  }, []);

  const register = useCallback(async (data: RegisterData) => {
    setError(null);
    setIsAuthPending(true);
    try {
      const newUser = await authRegister(data);
      setUser(newUser);
    } catch (err: unknown) {
      const apiErr = err as { error?: string };
      setError(apiErr.error || 'Registration failed');
      throw err;
    } finally {
      setIsAuthPending(false);
    }
  }, []);

  const loginWithGoogle = useCallback(async (data: GoogleExchangeRequestData): Promise<User> => {
    setError(null);
    setIsAuthPending(true);
    try {
      const loggedInUser = await authGoogleExchange(data);
      setUser(loggedInUser);
      return loggedInUser;
    } catch (err: unknown) {
      const apiErr = err as { error?: string };
      setError(apiErr.error || 'Google sign-in failed');
      throw err;
    } finally {
      setIsAuthPending(false);
    }
  }, []);

  const linkGoogle = useCallback(async (data: GoogleLinkRequestData): Promise<User> => {
    setError(null);
    setIsAuthPending(true);
    try {
      const updatedUser = await authGoogleLink(data);
      setUser(updatedUser);
      return updatedUser;
    } catch (err: unknown) {
      const apiErr = err as { error?: string };
      setError(apiErr.error || 'Google link failed');
      throw err;
    } finally {
      setIsAuthPending(false);
    }
  }, []);

  const logout = useCallback(async () => {
    setIsAuthPending(true);
    try {
      await authLogout();
    } finally {
      setUser(null);
      queryClient.clear();
      setIsAuthPending(false);
    }
  }, [queryClient]);

  const deleteAccount = useCallback(async (data?: DeleteAccountRequestData) => {
    setIsAuthPending(true);
    try {
      await authDeleteAccount(data);
      await authLogout();
    } finally {
      setUser(null);
      queryClient.clear();
      setIsAuthPending(false);
    }
  }, [queryClient]);

  const getEmailVerificationStatus = useCallback(async (): Promise<EmailVerificationStatus> => {
    return authGetEmailVerificationStatus();
  }, []);

  const sendEmailVerificationCode = useCallback(async () => {
    await authSendEmailVerificationCode();
  }, []);

  const confirmEmailVerificationCode = useCallback(async (data: EmailVerificationConfirmData) => {
    await authConfirmEmailVerificationCode(data);
    const currentUser = await checkAuth();
    setUser(currentUser);
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const getWsTicket = useCallback(async (): Promise<string> => {
    if (!isAuthenticated) throw new Error('Not authenticated');
    return authGetWsTicket();
  }, [isAuthenticated]);

  const updateProfile = useCallback(
    async (data: { username?: string; profile_picture?: string }) => {
      await authUpdateProfile(data);
      setUser((prev) =>
        prev
          ? {
            ...prev,
            username: data.username ?? prev.username,
            profile_picture: data.profile_picture ?? prev.profile_picture,
          }
          : prev
      );
    },
    []
  );

  const getActiveSessions = useCallback(async () => {
    return authGetActiveSessions();
  }, []);

  const revokeSession = useCallback(async (sessionId: number) => {
    await authRevokeSession(sessionId);
  }, []);

  const logoutAllDevices = useCallback(async () => {
    setIsAuthPending(true);
    try {
      await authLogoutAllDevices();
    } finally {
      await authLogout();
      setUser(null);
      queryClient.clear();
      setIsAuthPending(false);
    }
  }, [queryClient]);

  const value = useMemo<AuthContextType>(
    () => ({
      user,
      isLoading,
      isAuthenticated,
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
      getActiveSessions,
      revokeSession,
      logoutAllDevices,
    }),
    [
      user,
      isLoading,
      isAuthenticated,
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
      getActiveSessions,
      revokeSession,
      logoutAllDevices,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
