'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { updateUserLanguage } from '@/lib/api/user';
import { useAuth } from '@/providers/AuthProvider';

type Locale = 'ru' | 'kk';

const LOCALE_COOKIE_NAME = 'NEXT_LOCALE';

export function LanguageSwitcher() {
    const [currentLocale, setCurrentLocale] = useState<Locale>('ru');
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();
    const { user } = useAuth();

    // Инициализация из cookie или user.language
    useEffect(() => {
        const cookies = document.cookie.split(';');
        const localeCookie = cookies.find(c => c.trim().startsWith(`${LOCALE_COOKIE_NAME}=`));
        if (localeCookie) {
            const locale = localeCookie.split('=')[1] as Locale;
            if (locale === 'ru' || locale === 'kk') {
                setCurrentLocale(locale);
            }
        } else if (user?.language) {
            setCurrentLocale(user.language as Locale);
        }
    }, [user?.language]);

    const switchLanguage = async (newLocale: Locale) => {
        if (newLocale === currentLocale || isLoading) return;

        setIsLoading(true);
        try {
            // Сохраняем в cookie для middleware
            document.cookie = `${LOCALE_COOKIE_NAME}=${newLocale}; path=/; max-age=${60 * 60 * 24 * 365}`;
            setCurrentLocale(newLocale);

            // Если пользователь авторизован — синхронизируем с БД
            if (user) {
                await updateUserLanguage(newLocale);
            }

            // Перезагружаем страницу для применения нового языка
            router.refresh();
        } catch (error) {
            console.error('Failed to switch language:', error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex items-center gap-1 rounded-lg bg-muted p-1">
            <button
                onClick={() => switchLanguage('ru')}
                disabled={isLoading}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${currentLocale === 'ru'
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                    }`}
                aria-label="Русский язык"
            >
                RU
            </button>
            <button
                onClick={() => switchLanguage('kk')}
                disabled={isLoading}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${currentLocale === 'kk'
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                    }`}
                aria-label="Қазақ тілі"
            >
                KZ
            </button>
        </div>
    );
}

// Хук для получения текущего языка
export function useLocale(): Locale {
    // Инициализируем state сразу из cookie (избегаем setState в useEffect)
    const [locale] = useState<Locale>(() => {
        if (typeof document === 'undefined') return 'ru';
        const cookies = document.cookie.split(';');
        const localeCookie = cookies.find(c => c.trim().startsWith(`${LOCALE_COOKIE_NAME}=`));
        if (localeCookie) {
            const value = localeCookie.split('=')[1] as Locale;
            if (value === 'ru' || value === 'kk') return value;
        }
        return 'ru';
    });

    return locale;
}
