import { api } from './client';
import { QuizResult, PaginatedResults } from './types';

interface PaginationParams {
    page?: number;
    page_size?: number;
}

/**
 * Обновляет язык интерфейса пользователя
 * @param language - 'ru' или 'kk'
 */
export async function updateUserLanguage(language: 'ru' | 'kk'): Promise<void> {
    await api.put('/api/users/me/language', { language });
}

/**
 * Получает историю игр текущего пользователя
 */
export async function getMyGameHistory(params?: PaginationParams): Promise<PaginatedResults<QuizResult>> {
    const query: Record<string, string> = {};
    if (params?.page) query.page = params.page.toString();
    if (params?.page_size) query.page_size = params.page_size.toString();

    // API возвращает { results, page, page_size, total }
    const response = await api.get<{ results: QuizResult[]; page: number; page_size: number; total: number }>(
        '/api/users/me/results',
        { query }
    );

    return {
        results: response.results,
        total: response.total,
        page: response.page,
        per_page: response.page_size,
    };
}


