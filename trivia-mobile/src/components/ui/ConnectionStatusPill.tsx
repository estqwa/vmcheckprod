import { useMemo } from 'react';
import { StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { ConnectionState } from '../../hooks/useQuizWS';
import { radii, spacing } from '../../theme/tokens';

interface Props {
    connectionState: ConnectionState;
    isOffline: boolean;
}

/**
 * Универсальный pill-компонент для отображения состояния WebSocket-соединения.
 * Используется в lobby и play экранах.
 */
export function ConnectionStatusPill({ connectionState, isOffline }: Props) {
    const { t } = useTranslation();

    const pill = useMemo(() => {
        if (isOffline) {
            return { text: t('quiz.offline'), bg: '#fecaca', color: '#7f1d1d' };
        }
        switch (connectionState) {
            case 'connected':
                return { text: t('quiz.connected'), bg: '#dcfce7', color: '#166534' };
            case 'reconnecting':
                return { text: t('quiz.reconnecting'), bg: '#ffedd5', color: '#9a3412' };
            case 'connecting':
                return { text: t('quiz.connecting'), bg: '#fef9c3', color: '#854d0e' };
            default:
                return { text: t('quiz.disconnected'), bg: '#fee2e2', color: '#991b1b' };
        }
    }, [connectionState, isOffline, t]);

    return (
        <Text style={[styles.pill, { backgroundColor: pill.bg, color: pill.color }]}>
            {pill.text}
        </Text>
    );
}

const styles = StyleSheet.create({
    pill: {
        fontSize: 11,
        fontWeight: '700',
        borderRadius: radii.pill,
        paddingHorizontal: spacing.sm,
        paddingVertical: 5,
        overflow: 'hidden',
    },
});
