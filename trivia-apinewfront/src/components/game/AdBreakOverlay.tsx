'use client';

import { useEffect, useState, useRef } from 'react';

interface AdBreakData {
    quiz_id: number;
    media_type: 'image' | 'video';
    media_url: string;
    duration_sec: number;
}

interface AdBreakOverlayProps {
    adData: AdBreakData | null;
    isVisible: boolean;
    onAdEnd?: () => void;
}

export function AdBreakOverlay({ adData, isVisible, onAdEnd }: AdBreakOverlayProps) {
    // State для отображения таймера
    const [timeRemaining, setTimeRemaining] = useState(0);

    // Refs для стабильных значений (не вызывают ре-рендер)
    const onAdEndRef = useRef(onAdEnd);
    const durationRef = useRef(0);

    // Обновляем callback ref
    useEffect(() => { onAdEndRef.current = onAdEnd; }, [onAdEnd]);

    // Единый effect для таймера рекламы
    // По React документации: setState вызывается ТОЛЬКО внутри setInterval callback
    useEffect(() => {
        if (!isVisible || !adData) {
            return;
        }

        // Сохраняем duration для использования в callback
        durationRef.current = adData.duration_sec;

        // Инициализируем через функциональное обновление из callback
        // Используем setTimeout(0) чтобы setState был в callback, а не напрямую в effect body
        const initTimer = setTimeout(() => {
            setTimeRemaining(durationRef.current);
        }, 0);

        // Countdown таймер — setState только внутри setInterval callback (React паттерн)
        const countdownTimer = setInterval(() => {
            setTimeRemaining(prev => {
                const next = prev - 1;
                if (next <= 0) {
                    clearInterval(countdownTimer);
                    onAdEndRef.current?.();
                    return 0;
                }
                return next;
            });
        }, 1000);

        return () => {
            clearTimeout(initTimer);
            clearInterval(countdownTimer);
        };
    }, [isVisible, adData]);

    if (!isVisible || !adData) {
        return null;
    }

    // Формируем полный URL для медиа
    const mediaUrl = adData.media_url.startsWith('http')
        ? adData.media_url
        : `${process.env.NEXT_PUBLIC_API_URL || ''}${adData.media_url}`;

    return (
        <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
            {/* Медиа контент */}
            <div className="absolute inset-0 flex items-center justify-center">
                {adData.media_type === 'video' ? (
                    <video
                        src={mediaUrl}
                        autoPlay
                        muted
                        playsInline
                        loop={false}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                            console.error('Ошибка загрузки видео:', e);
                        }}
                    />
                ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                        src={mediaUrl}
                        alt="Рекламный блок"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                            console.error('Ошибка загрузки изображения:', e);
                        }}
                    />
                )}
            </div>

            {/* Оверлей с таймером */}
            <div className="absolute top-4 right-4 z-10">
                <div className="bg-black/60 text-white px-4 py-2 rounded-full text-sm font-medium backdrop-blur-sm">
                    Реклама • {timeRemaining} сек
                </div>
            </div>

            {/* Градиентный оверлей снизу */}
            <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-black/50 to-transparent pointer-events-none" />

            {/* Прогресс-бар */}
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
                <div
                    className="h-full bg-white transition-all duration-1000 ease-linear"
                    style={{
                        width: `${((adData.duration_sec - timeRemaining) / adData.duration_sec) * 100}%`,
                    }}
                />
            </div>
        </div>
    );
}
