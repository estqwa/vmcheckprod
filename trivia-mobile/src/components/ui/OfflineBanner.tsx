import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import { spacing } from '../../theme/tokens';
import { StateBanner } from './StateBanner';

export function OfflineBanner() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { isOffline } = useNetworkStatus();

  if (!isOffline) {
    return null;
  }

  return (
    <View pointerEvents="none" style={[styles.wrapper, { top: insets.top + spacing.xs }]}>
      <StateBanner
        tone="offline"
        title={t('common.offlineTitle')}
        description={t('common.offlineRealtimeHint')}
        accessibilityRole="alert"
      />
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
});
