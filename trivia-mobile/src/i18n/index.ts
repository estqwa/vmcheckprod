// =============================================================================
// @trivia/mobile — i18n Setup
// Локализация: русский (по умолчанию) и казахский
// =============================================================================

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';

import ru from './locales/ru.json';
import kk from './locales/kk.json';

const resources = {
    ru: { translation: ru },
    kk: { translation: kk },
};

// Определяем язык устройства, fallback на русский
const deviceLocale = Localization.getLocales()?.[0]?.languageCode ?? 'ru';
const supportedLangs = ['ru', 'kk'];
const initialLang = supportedLangs.includes(deviceLocale) ? deviceLocale : 'ru';

i18n
    .use(initReactI18next)
    .init({
        resources,
        lng: initialLang,
        fallbackLng: 'ru',
        interpolation: {
            escapeValue: false, // React уже экранирует
        },
        compatibilityJSON: 'v4',
    });

export default i18n;
