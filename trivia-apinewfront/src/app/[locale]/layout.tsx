import { NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { routing } from '@/i18n/routing';
import { notFound } from 'next/navigation';

// Генерация статических параметров для всех локалей
export function generateStaticParams() {
    return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
    children,
    params
}: {
    children: React.ReactNode;
    params: Promise<{ locale: string }>;
}) {
    const { locale } = await params;

    // Проверяем что локаль поддерживается
    if (!routing.locales.includes(locale as 'ru' | 'kk')) {
        notFound();
    }

    // Устанавливаем локаль для текущего запроса
    setRequestLocale(locale);

    // Загружаем сообщения для текущей локали
    const messages = await getMessages();

    return (
        <NextIntlClientProvider messages={messages}>
            {children}
        </NextIntlClientProvider>
    );
}
