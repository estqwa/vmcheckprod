'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { api } from '@/lib/api/client';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

interface AdAsset {
    id: number;
    title: string;
    media_type: 'image' | 'video';
    url: string;
    duration_sec: number;
}

interface QuizAdSlot {
    id: number;
    quiz_id: number;
    question_after: number;
    ad_asset_id: number;
    is_active: boolean;
    ad_asset?: AdAsset;
}

interface AdSlotsEditorProps {
    quizId: number;
    questionCount: number;
}


export function AdSlotsEditor({ quizId, questionCount }: AdSlotsEditorProps) {
    const [slots, setSlots] = useState<QuizAdSlot[]>([]);
    const [ads, setAds] = useState<AdAsset[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isAdding, setIsAdding] = useState(false);

    // Form state for new slot
    const [selectedQuestion, setSelectedQuestion] = useState(1);
    const [selectedAdId, setSelectedAdId] = useState<number | null>(null);

    // Fetch slots
    const fetchSlots = useCallback(async () => {
        try {
            const response = await fetch(`${API_URL}/api/quizzes/${quizId}/ad-slots`, {
                credentials: 'include',
            });
            if (!response.ok) throw new Error('Failed to fetch slots');
            const data = await response.json();
            setSlots(data.items || []);
        } catch (error) {
            console.error('Failed to fetch slots:', error);
        }
    }, [quizId]);

    // Fetch available ads
    const fetchAds = useCallback(async () => {
        try {
            const response = await fetch(`${API_URL}/api/admin/ads`, {
                credentials: 'include',
            });
            if (!response.ok) throw new Error('Failed to fetch ads');
            const data = await response.json();
            setAds(data.items || []);
        } catch (error) {
            console.error('Failed to fetch ads:', error);
        }
    }, []);

    useEffect(() => {
        Promise.all([fetchSlots(), fetchAds()]).finally(() => setIsLoading(false));
    }, [fetchSlots, fetchAds]);

    // Get available question numbers (not already used)
    const usedQuestions = slots.map(s => s.question_after);
    const availableQuestions = Array.from({ length: questionCount }, (_, i) => i + 1)
        .filter(q => !usedQuestions.includes(q));

    // Create slot
    const handleCreateSlot = async () => {
        if (!selectedAdId) {
            toast.error('Выберите рекламу');
            return;
        }

        setIsAdding(true);
        try {
            await api.post(`/api/quizzes/${quizId}/ad-slots`, {
                question_after: selectedQuestion,
                ad_asset_id: selectedAdId,
                is_active: true,
            });

            toast.success('Слот добавлен');
            fetchSlots();
            // Reset form
            if (availableQuestions.length > 1) {
                setSelectedQuestion(availableQuestions.find(q => q !== selectedQuestion) || 1);
            }
        } catch (error) {
            console.error('Create slot failed:', error);
            toast.error(error instanceof Error ? error.message : 'Ошибка создания слота');
        } finally {
            setIsAdding(false);
        }
    };

    // Toggle slot active
    const handleToggleActive = async (slot: QuizAdSlot) => {
        try {
            await api.put(`/api/quizzes/${quizId}/ad-slots/${slot.id}`, { is_active: !slot.is_active });
            fetchSlots();
        } catch (error) {
            console.error('Update slot failed:', error);
            toast.error('Ошибка обновления');
        }
    };

    // Delete slot
    const handleDeleteSlot = async (slotId: number) => {
        if (!confirm('Удалить этот слот?')) return;

        try {
            await api.delete(`/api/quizzes/${quizId}/ad-slots/${slotId}`);
            toast.success('Слот удален');
            fetchSlots();
        } catch (error) {
            console.error('Delete slot failed:', error);
            toast.error('Ошибка удаления');
        }
    };

    if (isLoading) {
        return <div className="text-center py-4 text-muted-foreground">Загрузка...</div>;
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-lg"> Рекламные слоты</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Add slot form */}
                {availableQuestions.length > 0 && ads.length > 0 && (
                    <div className="flex flex-wrap gap-2 items-end p-3 bg-muted/50 rounded-lg">
                        <div>
                            <label className="text-xs text-muted-foreground">После вопроса</label>
                            <select
                                value={selectedQuestion}
                                onChange={(e) => setSelectedQuestion(Number(e.target.value))}
                                className="block w-20 h-9 px-2 border rounded-md bg-background text-sm"
                            >
                                {availableQuestions.map(q => (
                                    <option key={q} value={q}>Q{q}</option>
                                ))}
                            </select>
                        </div>
                        <div className="flex-1 min-w-[150px]">
                            <label className="text-xs text-muted-foreground">Реклама</label>
                            <select
                                value={selectedAdId || ''}
                                onChange={(e) => setSelectedAdId(Number(e.target.value))}
                                className="block w-full h-9 px-2 border rounded-md bg-background text-sm"
                            >
                                <option value="">Выберите...</option>
                                {ads.map(ad => (
                                    <option key={ad.id} value={ad.id}>
                                        {ad.title} ({ad.duration_sec}с)
                                    </option>
                                ))}
                            </select>
                        </div>
                        <Button size="sm" onClick={handleCreateSlot} disabled={isAdding}>
                            {isAdding ? '...' : '+ Добавить'}
                        </Button>
                    </div>
                )}

                {ads.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                        Сначала загрузите рекламы в разделе{' '}
                        <Link href="/admin/ads" className="text-primary underline">Рекламные материалы</Link>
                    </p>
                )}

                {/* Slots list */}
                {slots.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                        Нет рекламных слотов
                    </p>
                ) : (
                    <div className="space-y-2">
                        {slots.sort((a, b) => a.question_after - b.question_after).map(slot => (
                            <div
                                key={slot.id}
                                className={`flex items-center gap-3 p-3 rounded-lg border ${slot.is_active ? 'bg-background' : 'bg-muted/50 opacity-60'
                                    }`}
                            >
                                <Badge variant="outline">Q{slot.question_after}</Badge>
                                <span className="flex-1 text-sm truncate">
                                    {slot.ad_asset?.title || `Реклама #${slot.ad_asset_id}`}
                                </span>
                                <Badge variant={slot.ad_asset?.media_type === 'video' ? 'default' : 'secondary'}>
                                    {slot.ad_asset?.media_type || '?'}
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                    {slot.ad_asset?.duration_sec || 10}с
                                </span>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleToggleActive(slot)}
                                >
                                    {slot.is_active ? '' : ''}
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDeleteSlot(slot.id)}
                                >
                                    
                                </Button>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
