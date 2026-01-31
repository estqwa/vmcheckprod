import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

export default createMiddleware(routing);

export const config = {
    // Применяем middleware ко всем путям кроме:
    // - /api (API routes)
    // - /_next (Next.js internal)
    // - /_vercel (Vercel assets)
    // - Файлы с расширениями (favicon.ico, images и т.д.)
    matcher: '/((?!api|_next|_vercel|.*\\..*).*)'
};
