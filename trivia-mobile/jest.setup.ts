/* eslint-disable @typescript-eslint/no-require-imports */

// React 19 test renderer expects this global flag for act() support.
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
(globalThis as unknown as { __DEV__: boolean }).__DEV__ = true;

// Mock expo-secure-store
jest.mock('expo-secure-store', () => ({
    getItemAsync: jest.fn().mockResolvedValue(null),
    setItemAsync: jest.fn().mockResolvedValue(undefined),
    deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

// Mock @react-native-community/netinfo
jest.mock('@react-native-community/netinfo', () => ({
    fetch: jest.fn().mockResolvedValue({ isConnected: true }),
    addEventListener: jest.fn(() => jest.fn()),
    useNetInfo: jest.fn(() => ({ isConnected: true, isInternetReachable: true })),
}));

// Mock expo-haptics
jest.mock('expo-haptics', () => ({
    impactAsync: jest.fn().mockResolvedValue(undefined),
    selectionAsync: jest.fn().mockResolvedValue(undefined),
    notificationAsync: jest.fn().mockResolvedValue(undefined),
    ImpactFeedbackStyle: { Light: 'Light', Medium: 'Medium', Heavy: 'Heavy' },
    NotificationFeedbackType: { Success: 'Success', Warning: 'Warning', Error: 'Error' },
}));

// Mock @react-native-async-storage/async-storage
jest.mock('@react-native-async-storage/async-storage', () => ({
    getItem: jest.fn().mockResolvedValue(null),
    setItem: jest.fn().mockResolvedValue(undefined),
    removeItem: jest.fn().mockResolvedValue(undefined),
    multiRemove: jest.fn().mockResolvedValue(undefined),
}));

// Mock expo-router
jest.mock('expo-router', () => ({
    useRouter: jest.fn(() => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() })),
    useLocalSearchParams: jest.fn(() => ({})),
    useSegments: jest.fn(() => ['(auth)']),
    Stack: { Screen: () => null },
}));

// Mock safe-area-context
jest.mock('react-native-safe-area-context', () => {
    const React = require('react');
    const { View } = require('react-native');
    return {
        SafeAreaView: ({ children, ...props }: { children: React.ReactNode }) => React.createElement(View, props, children),
        useSafeAreaInsets: jest.fn(() => ({ top: 0, left: 0, right: 0, bottom: 0 })),
    };
});

// Mock vector icons
jest.mock('@expo/vector-icons', () => {
    const React = require('react');
    const { Text } = require('react-native');
    return {
        Ionicons: ({ name }: { name: string }) => React.createElement(Text, null, name),
    };
});

// Mock expo-localization
jest.mock('expo-localization', () => ({
    getLocales: jest.fn(() => [{ languageCode: 'ru' }]),
}));

// Mock expo-constants (used in config.ts)
jest.mock('expo-constants', () => ({
    __esModule: true,
    default: { expoConfig: { extra: {} } },
    expoConfig: { extra: {} },
}));

// Mock react-i18next
jest.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'ru', changeLanguage: jest.fn() } }),
    initReactI18next: { type: '3rdParty', init: jest.fn() },
}));

// Mock @sentry/react-native
jest.mock('@sentry/react-native', () => ({
    init: jest.fn(),
    wrap: jest.fn((c: unknown) => c),
    captureException: jest.fn(),
}));
