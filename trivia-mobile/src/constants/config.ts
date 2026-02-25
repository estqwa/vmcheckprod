import Constants from 'expo-constants';

// Optional local backend URL for Android emulator (use via EXPO_PUBLIC_API_URL).
const LOCAL_ANDROID_EMULATOR_API_URL = 'http://10.0.2.2:8080';
const PROD_API_URL = 'https://qazaquiz.duckdns.org';

const extraConfig = Constants.expoConfig?.extra;
const envApiUrl = process.env.EXPO_PUBLIC_API_URL;
const envWsUrl = process.env.EXPO_PUBLIC_WS_URL;
const extraApiUrl = typeof extraConfig?.apiUrl === 'string' ? extraConfig.apiUrl : undefined;
const extraWsUrl = typeof extraConfig?.wsUrl === 'string' ? extraConfig.wsUrl : undefined;
const defaultApiUrl = PROD_API_URL;

export const API_URL: string = envApiUrl || extraApiUrl || defaultApiUrl;

export const WS_URL: string =
  envWsUrl ||
  extraWsUrl ||
  API_URL.replace(/^https:/, 'wss:').replace(/^http:/, 'ws:');

if (__DEV__) {
  console.log(
    `[MobileConfig] API_URL=${API_URL}; WS_URL=${WS_URL}; localOverrideHint=${LOCAL_ANDROID_EMULATOR_API_URL}`
  );
}

export const DEVICE_ID_KEY = 'trivia_device_id';
export const ACCESS_TOKEN_KEY = 'trivia_access_token';
export const REFRESH_TOKEN_KEY = 'trivia_refresh_token';

export const GOOGLE_OAUTH_ENABLED = process.env.EXPO_PUBLIC_GOOGLE_OAUTH_ENABLED !== 'false';
export const GOOGLE_ANDROID_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || '';
export const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || '';
export const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '';
export const LEGAL_TOS_VERSION = process.env.EXPO_PUBLIC_LEGAL_TOS_VERSION || '1.0';
export const LEGAL_PRIVACY_VERSION = process.env.EXPO_PUBLIC_LEGAL_PRIVACY_VERSION || '1.0';

export const WS_HEARTBEAT_INTERVAL = 30000;
export const WS_MAX_RECONNECT_ATTEMPTS = 5;
export const WS_INITIAL_RECONNECT_DELAY = 1000;
export const WS_MAX_RECONNECT_DELAY = 30000;
export const WS_RECONNECT_GRACE_PERIOD = 2000;
