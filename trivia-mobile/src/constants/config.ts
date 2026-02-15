import Constants from 'expo-constants';

// Default development URL for local Android emulator.
const DEV_API_URL = 'http://10.0.2.2:8080';
const PROD_API_URL = 'https://qazaquiz.duckdns.org';

const extraConfig = Constants.expoConfig?.extra;
const envApiUrl = process.env.EXPO_PUBLIC_API_URL;
const envWsUrl = process.env.EXPO_PUBLIC_WS_URL;
const extraApiUrl = typeof extraConfig?.apiUrl === 'string' ? extraConfig.apiUrl : undefined;
const extraWsUrl = typeof extraConfig?.wsUrl === 'string' ? extraConfig.wsUrl : undefined;
const defaultApiUrl = __DEV__ ? DEV_API_URL : PROD_API_URL;

export const API_URL: string = envApiUrl || extraApiUrl || defaultApiUrl;

export const WS_URL: string =
  envWsUrl ||
  extraWsUrl ||
  API_URL.replace(/^https:/, 'wss:').replace(/^http:/, 'ws:');

export const DEVICE_ID_KEY = 'trivia_device_id';
export const ACCESS_TOKEN_KEY = 'trivia_access_token';
export const REFRESH_TOKEN_KEY = 'trivia_refresh_token';

export const WS_HEARTBEAT_INTERVAL = 30000;
export const WS_MAX_RECONNECT_ATTEMPTS = 5;
export const WS_INITIAL_RECONNECT_DELAY = 1000;
export const WS_MAX_RECONNECT_DELAY = 30000;
export const WS_RECONNECT_GRACE_PERIOD = 2000;
