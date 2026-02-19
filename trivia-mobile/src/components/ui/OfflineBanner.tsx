import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import { radii, spacing } from '../../theme/tokens';

export function OfflineBanner() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { isOffline } = useNetworkStatus();

  if (!isOffline) {
    return null;
  }

  return (
    <View pointerEvents="none" style={[styles.wrapper, { top: insets.top + spacing.xs }]}>
      <View style={styles.banner} accessibilityRole="alert" accessibilityLiveRegion="assertive">
        <Text style={styles.title}>{t('common.offlineTitle')}</Text>
        <Text style={styles.subtitle}>{t('common.offlineRealtimeHint')}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    zIndex: 1000,
  },
  banner: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: '#fca5a5',
    backgroundColor: '#fee2e2',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  title: {
    color: '#991b1b',
    fontSize: 12,
    fontWeight: '800',
  },
  subtitle: {
    color: '#7f1d1d',
    fontSize: 11,
    marginTop: 2,
  },
});

