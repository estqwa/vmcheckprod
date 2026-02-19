// =============================================================================
// @trivia/mobile — i18n Setup
// Локализация: русский (по умолчанию) и казахский
// Персистенция выбранного языка через AsyncStorage
// =============================================================================

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';

import ru from './locales/ru.json';
import kk from './locales/kk.json';

const LANGUAGE_STORAGE_KEY = 'app_language';
export const SUPPORTED_LANGS = ['ru', 'kk'] as const;
export type SupportedLang = (typeof SUPPORTED_LANGS)[number];

const resources = {
    ru: { translation: ru },
    kk: { translation: kk },
};

// Определяем язык устройства, fallback на русский
const deviceLocale = Localization.getLocales()?.[0]?.languageCode ?? 'ru';
const initialLang = SUPPORTED_LANGS.includes(deviceLocale as SupportedLang) ? deviceLocale : 'ru';

i18n
    .use(initReactI18next)
    .init({
        resources,
        lng: initialLang, // sync fallback — device locale
        fallbackLng: 'ru',
        interpolation: {
            escapeValue: false, // React уже экранирует
        },
        compatibilityJSON: 'v4',
    });

// ---------------------------------------------------------------------------
// Async: загрузить сохранённый язык после инициализации
// Сначала рендерится с device locale, потом (если есть saved) переключается
// ---------------------------------------------------------------------------
async function loadSavedLanguage(): Promise<void> {
    try {
        const saved = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
        if (saved && SUPPORTED_LANGS.includes(saved as SupportedLang) && saved !== i18n.language) {
            await i18n.changeLanguage(saved);
        }
    } catch {
        // Если AsyncStorage недоступен — используем device locale
        if (__DEV__) console.warn('[i18n] Failed to load saved language');
    }
}

void loadSavedLanguage();

/**
 * Сохранить выбранный язык в AsyncStorage и переключить i18n.
 */
export async function changeAndPersistLanguage(lang: SupportedLang): Promise<void> {
    await i18n.changeLanguage(lang);
    try {
        await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
    } catch {
        if (__DEV__) console.warn('[i18n] Failed to save language preference');
    }
}

export default i18n;
