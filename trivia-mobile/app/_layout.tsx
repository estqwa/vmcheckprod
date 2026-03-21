import { useEffect } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Stack, type ErrorBoundaryProps } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import * as Sentry from '@sentry/react-native';
import * as WebBrowser from 'expo-web-browser';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryProvider } from '../src/providers/QueryProvider';
import { AuthProvider, useAuth } from '../src/providers/AuthProvider';
import { OfflineBanner } from '../src/components/ui/OfflineBanner';
import { palette, radii, spacing } from '../src/theme/tokens';
import i18n from '../src/i18n';

const sentryDsn = (process.env.EXPO_PUBLIC_SENTRY_DSN || '').trim();
const sentryEnabled = !__DEV__ && sentryDsn.length > 0;

if (sentryEnabled) {
  Sentry.init({
    dsn: sentryDsn,
    tracesSampleRate: 0.2,
  });
}

SplashScreen.preventAutoHideAsync();
WebBrowser.maybeCompleteAuthSession();

export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return (
    <View style={styles.errorContainer}>
      <View style={styles.errorCard}>
        <Text style={styles.errorTitle}>{i18n.t('error.title', 'Something went wrong')}</Text>
        <Text style={styles.errorText}>{error.message}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={retry} accessibilityRole="button" accessibilityLabel={i18n.t('error.retry', 'Try again')}>
          <Text style={styles.retryButtonText}>{i18n.t('error.retry', 'Try again')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function AppContent() {
  const { isBootstrapping } = useAuth();

  useEffect(() => {
    if (!isBootstrapping) {
      void SplashScreen.hideAsync();
    }
  }, [isBootstrapping]);

  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="quiz/[id]" />
        <Stack.Screen name="profile/history" />
        <Stack.Screen name="profile/sessions" />
        <Stack.Screen name="profile/delete-account" />
        <Stack.Screen name="terms" />
        <Stack.Screen name="privacy" />
        <Stack.Screen name="official-rules" />
      </Stack>
      <OfflineBanner />
      <StatusBar style="dark" />
    </>
  );
}

function RootLayout() {
  return (
    <View style={styles.root}>
      <SafeAreaProvider>
        <QueryProvider>
          <AuthProvider>
            <AppContent />
          </AuthProvider>
        </QueryProvider>
      </SafeAreaProvider>
    </View>
  );
}

export default sentryEnabled ? Sentry.wrap(RootLayout) : RootLayout;

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
    borderColor: palette.errorSoftBorder,
    backgroundColor: palette.errorSoftBg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  errorTitle: {
    color: palette.errorTextStrong,
    fontSize: 18,
    fontWeight: '800',
  },
  errorText: {
    color: palette.errorTextMuted,
  },
  retryButton: {
    minHeight: 44,
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

