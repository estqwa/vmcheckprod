/**
 * Locale-aware currency formatting for KZT (Kazakhstani Tenge).
 * Uses Intl.NumberFormat — no hardcoded $ or ₸ symbols.
 *
 * @param value  — numeric amount
 * @param locale — 'ru' | 'kk' (defaults to 'ru')
 * @returns formatted string, e.g. "1 000 000 ₸"
 */
export function formatCurrency(value: number, locale: string = 'ru'): string {
    return new Intl.NumberFormat(locale === 'kk' ? 'kk-KZ' : 'ru-RU', {
        style: 'currency',
        currency: 'KZT',
        maximumFractionDigits: 0,
    }).format(value);
}
