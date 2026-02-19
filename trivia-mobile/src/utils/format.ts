import i18n from '../i18n';

/**
 * Locale-aware currency formatting for KZT (Kazakhstani Tenge).
 * Uses Intl.NumberFormat — consistent with web formatCurrency.
 *
 * @param value — numeric amount
 * @returns formatted string, e.g. "1 000 000 ₸"
 */
export function formatCurrency(value: number): string {
    const locale = i18n.language === 'kk' ? 'kk-KZ' : 'ru-RU';
    return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: 'KZT',
        maximumFractionDigits: 0,
    }).format(value);
}
