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
import type { User } from '@trivia/shared';
import {
  login as authLogin,
  register as authRegister,
  logout as authLogout,
  checkAuth,
  getWsTicket as authGetWsTicket,
  updateProfile as authUpdateProfile,
} from '../api/auth';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
  getWsTicket: () => Promise<string>;
  updateProfile: (data: { username?: string; profile_picture?: string }) => Promise<void>;
  setUser: (user: User | null) => void;
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

    if (!isAuthenticated && !inAuthGroup) {
      router.replace('/(auth)/login');
      return;
    }

    if (isAuthenticated && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [isAuthenticated, isBootstrapping, segments, router]);

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

  const register = useCallback(async (username: string, email: string, password: string) => {
    setError(null);
    setIsAuthPending(true);
    try {
      const newUser = await authRegister({ username, email, password });
      setUser(newUser);
    } catch (err: unknown) {
      const apiErr = err as { error?: string };
      setError(apiErr.error || 'Registration failed');
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

  const value = useMemo<AuthContextType>(
    () => ({
      user,
      isLoading,
      isAuthenticated,
      error,
      login,
      register,
      logout,
      clearError,
      getWsTicket,
      updateProfile,
      setUser,
    }),
    [user, isLoading, isAuthenticated, error, login, register, logout, clearError, getWsTicket, updateProfile]
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
