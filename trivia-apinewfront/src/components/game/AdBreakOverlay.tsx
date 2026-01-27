'use client';

import { useEffect, useState } from 'react';

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
    const [timeRemaining, setTimeRemaining] = useState(0);

    // Инициализация и обратный отсчёт
    useEffect(() => {
        if (!isVisible || !adData) {
            setTimeRemaining(0);
            return;
        }

        // Устанавливаем начальное время
        setTimeRemaining(adData.duration_sec);

        // Запускаем таймер обратного отсчёта
        const timer = setInterval(() => {
            setTimeRemaining((prev) => {
                if (prev <= 1) {
                    clearInterval(timer);
                    onAdEnd?.();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [isVisible, adData, onAdEnd]);

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
