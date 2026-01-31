import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  // Список поддерживаемых языков
  locales: ['ru', 'kk'],
  
  // Язык по умолчанию — русский
  defaultLocale: 'ru',
  
  // Стратегия отображения locale в URL
  // 'as-needed' — не показывать defaultLocale в URL (ru будет по умолчанию без /ru/)
  localePrefix: 'as-needed'
});

// Экспортируем типы для использования в других файлах
export type Locale = (typeof routing.locales)[number];
