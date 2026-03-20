import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { ConnectionState } from '../../hooks/useQuizWS';
import { StatusBadge } from './StatusBadge';

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
            return { text: t('quiz.offline'), tone: 'offline' as const };
        }
        switch (connectionState) {
            case 'connected':
                return { text: t('quiz.connected'), tone: 'success' as const };
            case 'reconnecting':
                return { text: t('quiz.reconnecting'), tone: 'warning' as const };
            case 'connecting':
                return { text: t('quiz.connecting'), tone: 'info' as const };
            default:
                return { text: t('quiz.disconnected'), tone: 'danger' as const };
        }
    }, [connectionState, isOffline, t]);

    return <StatusBadge tone={pill.tone} label={pill.text} />;
}
