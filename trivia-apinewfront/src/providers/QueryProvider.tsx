'use client'

import {
    isServer,
    QueryClient,
    QueryClientProvider,
} from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { ReactNode } from 'react'

function makeQueryClient() {
    return new QueryClient({
        defaultOptions: {
            queries: {
                // С SSR, устанавливаем staleTime > 0 чтобы избежать refetch сразу после гидратации
                staleTime: 60 * 1000, // 1 минута — данные считаются свежими
                gcTime: 5 * 60 * 1000, // 5 минут — кеш живёт
                refetchOnWindowFocus: true, // обновлять при фокусе вкладки
                retry: 1, // 1 повтор при ошибке
            },
        },
    })
}

let browserQueryClient: QueryClient | undefined = undefined

export function getQueryClient() {
    if (isServer) {
        // Сервер: всегда создаём новый клиент
        return makeQueryClient()
    } else {
        // Браузер: создаём singleton клиент
        // Это важно, чтобы не пересоздавать клиент при suspense
        if (!browserQueryClient) browserQueryClient = makeQueryClient()
        return browserQueryClient
    }
}

export function QueryProvider({ children }: { children: ReactNode }) {
    // NOTE: Избегаем useState при инициализации query client
    // для предотвращения проблем с suspense
    const queryClient = getQueryClient()

    return (
        <QueryClientProvider client={queryClient}>
            {children}
            <ReactQueryDevtools initialIsOpen={false} />
        </QueryClientProvider>
    )
}
