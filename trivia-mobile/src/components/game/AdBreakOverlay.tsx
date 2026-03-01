import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image, Modal, StyleSheet, Text, View } from 'react-native';
import { createVideoPlayer, type VideoPlayer, VideoView } from 'expo-video';
import { useTranslation } from 'react-i18next';
import type { QuizAdBreakEvent } from '@trivia/shared';
import { API_URL } from '../../constants/config';
import { palette, radii, spacing } from '../../theme/tokens';

type AdBreakOverlayProps = {
  adData: QuizAdBreakEvent | null;
  isVisible: boolean;
  onAdEnd?: () => void;
};

function resolveMediaUrl(mediaUrl: string): string {
  if (/^https?:\/\//i.test(mediaUrl)) {
    return mediaUrl;
  }

  if (mediaUrl.startsWith('/')) {
    return `${API_URL}${mediaUrl}`;
  }

  return `${API_URL}/${mediaUrl}`;
}

export function AdBreakOverlay({ adData, isVisible, onAdEnd }: AdBreakOverlayProps) {
  const { t } = useTranslation();
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [hasMediaError, setHasMediaError] = useState(false);
  const [player, setPlayer] = useState<VideoPlayer | null>(null);
  const onAdEndRef = useRef(onAdEnd);
  const hasSignaledEndRef = useRef(false);

  useEffect(() => {
    onAdEndRef.current = onAdEnd;
  }, [onAdEnd]);

  const mediaUrl = useMemo(() => {
    if (!adData) return '';
    return resolveMediaUrl(adData.media_url);
  }, [adData]);

  const adSessionKey = useMemo(() => {
    if (!isVisible || !adData) return '';
    return `${adData.quiz_id}:${adData.media_type}:${adData.media_url}:${adData.duration_sec}`;
  }, [adData, isVisible]);

  const isVideo = adData?.media_type === 'video';

  const signalAdEnd = useCallback(() => {
    if (hasSignaledEndRef.current) return;
    hasSignaledEndRef.current = true;
    onAdEndRef.current?.();
  }, []);

  const progressPercent = useMemo(() => {
    if (!adData || adData.duration_sec <= 0) return 0;
    return Math.min(100, Math.max(0, ((adData.duration_sec - timeRemaining) / adData.duration_sec) * 100));
  }, [adData, timeRemaining]);

  useEffect(() => {
    if (!adSessionKey || !adData) return;

    hasSignaledEndRef.current = false;
    setHasMediaError(false);
    const duration = Math.max(0, adData.duration_sec);
    setTimeRemaining(duration);

    if (duration === 0) {
      signalAdEnd();
      return;
    }

    const timerId = setInterval(() => {
      setTimeRemaining((prev: number) => {
        if (prev <= 1) {
          clearInterval(timerId);
          signalAdEnd();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearInterval(timerId);
    };
  }, [adData, adSessionKey, signalAdEnd]);

  useEffect(() => {
    if (!adSessionKey || !adData || !isVideo) {
      setPlayer((prev: VideoPlayer | null) => {
        if (prev) {
          try {
            prev.pause();
            prev.release();
          } catch {
            // no-op
          }
        }
        return null;
      });
      return;
    }

    try {
      const nextPlayer = createVideoPlayer(mediaUrl);
      const statusSubscription = nextPlayer.addListener('statusChange', ({ error }: { error?: unknown }) => {
        if (error) {
          setHasMediaError(true);
          signalAdEnd();
        }
      });
      const playToEndSubscription = nextPlayer.addListener('playToEnd', () => {
        signalAdEnd();
      });
      nextPlayer.loop = false;
      nextPlayer.play();
      setPlayer(nextPlayer);

      return () => {
        statusSubscription.remove();
        playToEndSubscription.remove();
        try {
          nextPlayer.pause();
          nextPlayer.release();
        } catch {
          // no-op
        }
        setPlayer((current: VideoPlayer | null) => (current === nextPlayer ? null : current));
      };
    } catch {
      setHasMediaError(true);
      return undefined;
    }
  }, [adData, adSessionKey, isVideo, mediaUrl, signalAdEnd]);

  if (!isVisible || !adData) {
    return null;
  }

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      statusBarTranslucent
      presentationStyle="overFullScreen"
      onRequestClose={() => undefined}
    >
      <View style={styles.overlay} accessibilityViewIsModal>
        <View style={styles.mediaFrame}>
          {hasMediaError ? (
            <View style={styles.errorState}>
              <Text style={styles.errorTitle}>{t('quiz.adUnavailable')}</Text>
            </View>
          ) : isVideo ? (
            player ? (
              <VideoView style={styles.media} player={player} nativeControls={false} contentFit="cover" />
            ) : (
              <View style={styles.errorState}>
                <Text style={styles.errorTitle}>{t('quiz.adUnavailable')}</Text>
              </View>
            )
          ) : (
            <Image
              source={{ uri: mediaUrl }}
              style={styles.media}
              resizeMode="cover"
              onError={() => setHasMediaError(true)}
            />
          )}

          <View style={styles.badge}>
            <Text style={styles.badgeTitle}>{t('quiz.adBreakLabel')}</Text>
            <Text style={styles.badgeText}>{t('quiz.adBreakCountdown', { seconds: timeRemaining })}</Text>
          </View>

          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mediaFrame: {
    width: '100%',
    height: '100%',
    position: 'relative',
    backgroundColor: '#000',
  },
  media: {
    width: '100%',
    height: '100%',
  },
  errorState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  errorTitle: {
    color: palette.white,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  badge: {
    position: 'absolute',
    top: spacing.xl,
    right: spacing.lg,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: '#ffffff44',
    backgroundColor: '#00000088',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  badgeTitle: {
    color: palette.white,
    fontSize: 11,
    fontWeight: '700',
  },
  badgeText: {
    color: '#f3f4f6',
    fontSize: 12,
    marginTop: 2,
  },
  progressTrack: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 4,
    backgroundColor: '#ffffff33',
  },
  progressFill: {
    height: '100%',
    backgroundColor: palette.white,
  },
});
