import { api } from './client';

/**
 * Обновляет язык интерфейса пользователя
 * @param language - 'ru' или 'kk'
 */
export async function updateUserLanguage(language: 'ru' | 'kk'): Promise<void> {
    await api.put('/api/users/me/language', { language });
}
