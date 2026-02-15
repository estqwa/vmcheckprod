import { useEffect } from 'react';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { QueryProvider } from '../src/providers/QueryProvider';
import { AuthProvider } from '../src/providers/AuthProvider';
import '../src/i18n';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  useEffect(() => {
    void SplashScreen.hideAsync();
  }, []);

  return (
    <QueryProvider>
      <AuthProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="quiz/[id]/lobby" />
          <Stack.Screen name="quiz/[id]/play" options={{ gestureEnabled: false }} />
          <Stack.Screen name="quiz/[id]/results" />
          <Stack.Screen name="profile/history" />
        </Stack>
        <StatusBar style="dark" />
      </AuthProvider>
    </QueryProvider>
  );
}
