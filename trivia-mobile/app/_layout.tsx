import { useEffect } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Stack, type ErrorBoundaryProps } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import * as Sentry from '@sentry/react-native';
import * as WebBrowser from 'expo-web-browser';
import { StatusBar } from 'expo-status-bar';
import { QueryProvider } from '../src/providers/QueryProvider';
import { AuthProvider } from '../src/providers/AuthProvider';
import { OfflineBanner } from '../src/components/ui/OfflineBanner';
import { palette, radii, spacing } from '../src/theme/tokens';
import i18n from '../src/i18n';

Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.2,
});

SplashScreen.preventAutoHideAsync();
WebBrowser.maybeCompleteAuthSession();

export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return (
    <View style={styles.errorContainer}>
      <View style={styles.errorCard}>
        <Text style={styles.errorTitle}>{i18n.t('error.title', 'Что-то пошло не так')}</Text>
        <Text style={styles.errorText}>{error.message}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={retry}>
          <Text style={styles.retryButtonText}>{i18n.t('error.retry', 'Попробовать снова')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function RootLayout() {
  useEffect(() => {
    void SplashScreen.hideAsync();
  }, []);

  return (
    <View style={styles.root}>
      <QueryProvider>
        <AuthProvider>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="quiz/[id]/lobby" />
            <Stack.Screen name="quiz/[id]/play" options={{ gestureEnabled: false }} />
            <Stack.Screen name="quiz/[id]/results" />
            <Stack.Screen name="profile/history" />
            <Stack.Screen name="profile/sessions" />
            <Stack.Screen name="profile/delete-account" />
            <Stack.Screen name="(auth)/verify-email" />
            <Stack.Screen name="terms" />
            <Stack.Screen name="privacy" />
          </Stack>
          <OfflineBanner />
          <StatusBar style="dark" />
        </AuthProvider>
      </QueryProvider>
    </View>
  );
}

export default Sentry.wrap(RootLayout);

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  errorContainer: {
    flex: 1,
    backgroundColor: palette.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  errorCard: {
    width: '100%',
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: '#fca5a5',
    backgroundColor: '#fff1f2',
    padding: spacing.lg,
    gap: spacing.sm,
  },
  errorTitle: {
    color: '#9f1239',
    fontSize: 18,
    fontWeight: '800',
  },
  errorText: {
    color: '#7f1d1d',
  },
  retryButton: {
    minHeight: 42,
    borderRadius: radii.md,
    backgroundColor: palette.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xs,
  },
  retryButtonText: {
    color: palette.white,
    fontWeight: '700',
  },
});
