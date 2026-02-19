import React, { type ReactNode } from 'react';
import { QueryClient, onlineManager } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import type { PersistedClient } from '@tanstack/react-query-persist-client';
import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ---------------------------------------------------------------------------
// Online / Offline — React Query автоматически pauses запросы при offline
// ---------------------------------------------------------------------------
onlineManager.setEventListener((setOnline) => {
  const unsubscribe = NetInfo.addEventListener((state) => {
    const isOnline = state.isConnected === true && state.isInternetReachable !== false;
    setOnline(isOnline);
  });
  return unsubscribe;
});

// ---------------------------------------------------------------------------
// QueryClient
// ---------------------------------------------------------------------------
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,      // 5 minutes
      gcTime: 1000 * 60 * 60 * 24,    // 24 hours — для persistence
      retry: (failureCount, error) => {
        const apiError = error as { error_type?: string } | null;
        if (apiError?.error_type === 'offline') {
          return false;
        }
        return failureCount < 2;
      },
      refetchOnWindowFocus: false,
    },
  },
});

// ---------------------------------------------------------------------------
// Persistence — кэш выживает перезапуск app
// ---------------------------------------------------------------------------
const SENSITIVE_QUERY_PREFIXES = ['auth', 'token', 'ws-ticket'];

const asyncStoragePersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  // Не сохраняем чувствительные данные в AsyncStorage
  serialize: (client: PersistedClient) => {
    const filteredState: PersistedClient = {
      ...client,
      clientState: {
        ...client.clientState,
        queries: client.clientState.queries.filter(
          (q: { queryKey: readonly unknown[] }) =>
            !SENSITIVE_QUERY_PREFIXES.some((prefix) =>
              Array.isArray(q.queryKey) && typeof q.queryKey[0] === 'string' && q.queryKey[0].startsWith(prefix)
            ),
        ),
      },
    };
    return JSON.stringify(filteredState);
  },
});

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------
export function QueryProvider({ children }: { children: ReactNode }) {
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister: asyncStoragePersister }}
    >
      {children}
    </PersistQueryClientProvider>
  );
}

export { queryClient };
