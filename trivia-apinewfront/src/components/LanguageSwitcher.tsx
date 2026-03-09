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
            document.cookie = `${LOCALE_COOKIE_NAME}=${newLocale}; path=/; max-age=${60 * 60 * 24 * 365}`;
            setCurrentLocale(newLocale);

            if (user) {
                await updateUserLanguage(newLocale);
            }

            router.refresh();
        } catch (error) {
            console.error('Failed to switch language:', error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="inline-flex min-h-10 items-center gap-1 rounded-xl border border-border/70 bg-muted/80 p-1 shadow-sm">
            <button
                type="button"
                onClick={() => switchLanguage('ru')}
                disabled={isLoading}
                aria-pressed={currentLocale === 'ru'}
                className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${currentLocale === 'ru'
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'bg-white/70 text-slate-700 hover:bg-white hover:text-foreground'
                    }`}
            >
                RU
                <span className="sr-only">, русский язык</span>
            </button>
            <button
                type="button"
                onClick={() => switchLanguage('kk')}
                disabled={isLoading}
                aria-pressed={currentLocale === 'kk'}
                className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${currentLocale === 'kk'
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'bg-white/70 text-slate-700 hover:bg-white hover:text-foreground'
                    }`}
            >
                KZ
                <span className="sr-only">, қазақ тілі</span>
            </button>
        </div>
    );
}

export function useLocale(): Locale {
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
