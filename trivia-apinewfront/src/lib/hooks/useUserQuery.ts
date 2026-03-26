import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getCurrentUser } from '@/lib/api/auth'
import { ApiError, User } from '@/lib/api/types'

/**
 * Query key для данных текущего пользователя.
 * Используется для инвалидации кеша после викторины.
 */
export const userQueryKey = ['user', 'me'] as const

/**
 * Query key для лидерборда.
 * Используется для инвалидации кеша после викторины.
 */
export const leaderboardQueryKey = ['leaderboard'] as const

type UserQueryError = ApiError | Error

function isAuthError(error: unknown): error is ApiError {
    if (!error || typeof error !== 'object') return false

    const apiError = error as ApiError
    if (apiError.status === 401) return true

    return [
        'token_missing',
        'token_invalid',
        'token_expired',
        'unauthorized',
    ].includes(apiError.error_type ?? '')
}

/**
 * Хук для получения данных текущего пользователя.
 * Использует TanStack Query для кеширования и автоматической ревалидации.
 */
export function useUserQuery(enabled: boolean = true) {
    return useQuery<User | null, UserQueryError>({
        queryKey: userQueryKey,
        queryFn: async () => {
            try {
                return await getCurrentUser()
            } catch (error) {
                if (!isAuthError(error)) {
                    throw error instanceof Error ? error : new Error('Failed to fetch current user')
                }

                // Только реальные auth-ошибки считаем состоянием "не авторизован".
                return null
            }
        },
        enabled,
        retry: (failureCount, error) => !isAuthError(error) && failureCount < 1,
        staleTime: 30 * 1000, // 30 секунд
        gcTime: 5 * 60 * 1000, // 5 минут
    })
}

/**
 * Хук для инвалидации данных пользователя.
 * Вызывается после завершения викторины для обновления статистики.
 */
export function useInvalidateUser() {
    const queryClient = useQueryClient()

    return () => {
        queryClient.invalidateQueries({ queryKey: userQueryKey })
    }
}

/**
 * Хук для инвалидации данных после завершения викторины.
 * Обновляет и профиль пользователя, и лидерборд.
 */
export function useInvalidateAfterQuiz() {
    const queryClient = useQueryClient()

    return () => {
        // Инвалидируем все связанные данные:
        // - Профиль пользователя (games_played, wins_count, total_score, total_prize_won)
        // - Лидерборд (wins_count, total_prize_won сортировка)
        queryClient.invalidateQueries({ queryKey: userQueryKey })
        queryClient.invalidateQueries({ queryKey: leaderboardQueryKey })
    }
}
