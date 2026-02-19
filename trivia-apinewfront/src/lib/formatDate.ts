/**
 * Shared locale-aware date formatting utility.
 * Replaces inline formatDate functions scattered across pages.
 *
 * @param dateStr - ISO date string
 * @param locale  - 'ru' | 'kk' (defaults to 'ru')
 * @param options - Intl.DateTimeFormatOptions override
 * @returns formatted date string
 */
export function formatDate(
    dateStr: string,
    locale: string = 'ru',
    options?: Intl.DateTimeFormatOptions,
): string {
    const date = new Date(dateStr);
    const resolvedLocale = locale === 'kk' ? 'kk-KZ' : 'ru-RU';

    const defaultOptions: Intl.DateTimeFormatOptions = {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    };

    return date.toLocaleDateString(resolvedLocale, options ?? defaultOptions);
}

/**
 * Short format for compact displays (e.g. quiz cards in admin)
 */
export function formatDateShort(dateStr: string, locale: string = 'ru'): string {
    return formatDate(dateStr, locale, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}
