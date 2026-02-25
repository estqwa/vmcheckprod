import { Platform } from 'react-native';
import * as AuthSession from 'expo-auth-session';
import {
  GOOGLE_ANDROID_CLIENT_ID,
  GOOGLE_IOS_CLIENT_ID,
  GOOGLE_OAUTH_ENABLED,
} from '../constants/config';

const discovery = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
  revocationEndpoint: 'https://oauth2.googleapis.com/revoke',
};

export function useGoogleCodeAuthRequest() {
  const platform: 'ios' | 'android' = Platform.OS === 'ios' ? 'ios' : 'android';
  const clientId = platform === 'ios' ? GOOGLE_IOS_CLIENT_ID : GOOGLE_ANDROID_CLIENT_ID;
  const enabled = GOOGLE_OAUTH_ENABLED && !!clientId;

  const redirectUri = AuthSession.makeRedirectUri({
    scheme: 'triviamobile',
    path: 'oauth/google',
  });

  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: clientId || 'disabled-client-id',
      redirectUri,
      scopes: ['openid', 'email', 'profile'],
      responseType: AuthSession.ResponseType.Code,
      usePKCE: true,
    },
    discovery
  );

  return {
    enabled,
    platform,
    clientId,
    redirectUri,
    request,
    response,
    promptAsync,
  };
}
