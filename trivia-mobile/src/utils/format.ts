import i18n from '../i18n';

function resolveLocaleTag(language: string): string {
  return language.startsWith('kk') ? 'kk-KZ' : 'ru-RU';
}

/**
 * Locale-aware currency formatting for KZT (Kazakhstani Tenge).
 * Uses Intl.NumberFormat — consistent with web formatCurrency.
 *
 * @param value — numeric amount
 * @returns formatted string, e.g. "1 000 000 ₸"
 */
export function formatCurrency(value: number): string {
  const locale = resolveLocaleTag(i18n.language);
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'KZT',
    maximumFractionDigits: 0,
  }).format(value);
}

/**
 * Locale-aware date/time formatting using current app language by default.
 */
export function formatDateTime(
  value: string | number | Date,
  language: string = i18n.language,
  options?: Intl.DateTimeFormatOptions,
): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return typeof value === 'string' ? value : '';
  }

  const locale = resolveLocaleTag(language);
  return date.toLocaleString(locale, options);
}

export { resolveLocaleTag };

