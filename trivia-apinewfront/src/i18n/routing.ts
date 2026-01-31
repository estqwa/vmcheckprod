import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  // Список поддерживаемых языков
  locales: ['ru', 'kk'],

  // Язык по умолчанию — русский
  defaultLocale: 'ru',

  // Скрываем префикс языка из URL полностью
  // URL будут: /login, /profile (без /ru/ или /kk/)
  // Язык определяется через cookie NEXT_LOCALE
  localePrefix: 'never'
});

// Экспортируем типы для использования в других файлах
export type Locale = (typeof routing.locales)[number];

