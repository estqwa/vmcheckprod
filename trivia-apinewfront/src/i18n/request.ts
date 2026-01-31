import { getRequestConfig } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { routing } from './routing';

export default getRequestConfig(async ({ requestLocale }) => {
    // Получаем запрошенную локаль из URL (соответствует сегменту [locale])
    const requested = await requestLocale;

    // Валидируем и используем fallback на defaultLocale если локаль не поддерживается
    const locale = hasLocale(routing.locales, requested)
        ? requested
        : routing.defaultLocale;

    return {
        locale,
        messages: (await import(`../../messages/${locale}.json`)).default
    };
});
