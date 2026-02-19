import { Platform } from 'react-native';

/**
 * Безопасная обертка над expo-haptics.
 * На web / нативных платформах без поддержки haptics -- ничего не делает.
 */

let Haptics: typeof import('expo-haptics') | null = null;

if (Platform.OS !== 'web') {
    // Динамический импорт: на web не подгружаем модуль
    try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        Haptics = require('expo-haptics') as typeof import('expo-haptics');
    } catch {
        // expo-haptics не установлен или платформа не поддерживается
    }
}

/** Легкий клик (selection). */
export function hapticSelection(): void {
    void Haptics?.selectionAsync().catch(() => undefined);
}

/** Успешный результат (success notification). */
export function hapticSuccess(): void {
    void Haptics?.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
}

/** Предупреждение/ошибка (warning notification). */
export function hapticWarning(): void {
    void Haptics?.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined);
}
