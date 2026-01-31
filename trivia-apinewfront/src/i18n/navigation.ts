import { createNavigation } from 'next-intl/navigation';
import { routing } from './routing';

// Создаём навигационные функции с поддержкой i18n
// Используйте эти функции вместо стандартных next/navigation
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);
