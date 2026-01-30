'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { api } from '@/lib/api/client';
import { useAuth } from '@/providers/AuthProvider';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

interface AdAsset {
    id: number;
    title: string;
    media_type: 'image' | 'video';
    url: string;
    thumbnail_url?: string;
    duration_sec: number;
    file_size_bytes?: number;
    created_at: string;
}

function AdsManagement() {
    const [ads, setAds] = useState<AdAsset[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isUploading, setIsUploading] = useState(false);

    const [title, setTitle] = useState('');
    const [mediaType, setMediaType] = useState<'image' | 'video'>('image');
    const [duration, setDuration] = useState(10);
    const [file, setFile] = useState<File | null>(null);

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
            toast.error('Не удалось загрузить список реклам');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchAds();
    }, [fetchAds]);

    const handleUpload = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!file || !title) {
            toast.error('Заполните все поля');
            return;
        }

        setIsUploading(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('title', title);
            formData.append('media_type', mediaType);
            formData.append('duration_sec', duration.toString());


            await api.post('/api/admin/ads', formData);

            toast.success('Реклама загружена');
            setTitle('');
            setFile(null);
            setDuration(10);
            fetchAds();
        } catch (error) {
            console.error('Upload failed:', error);
            toast.error(error instanceof Error ? error.message : 'Ошибка загрузки');
        } finally {
            setIsUploading(false);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Удалить эту рекламу?')) return;

        try {
            await api.delete(`/api/admin/ads/${id}`);

            toast.success('Реклама удалена');
            fetchAds();
        } catch (error) {
            console.error('Delete failed:', error);
            toast.error(error instanceof Error ? error.message : 'Ошибка удаления');
        }
    };

    const formatFileSize = (bytes?: number) => {
        if (!bytes) return '-';
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    return (
        <div className="min-h-screen">
            {/* Header */}
            <header className="border-b border-border/50 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
                <div className="container max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
                    <Link href="/" className="flex items-center gap-2">
                        <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
                            <span className="text-white font-bold text-lg">Q</span>
                        </div>
                        <span className="font-bold text-xl text-foreground">QazaQuiz</span>
                        <Badge className="bg-primary/10 text-primary border-0 ml-2">Админ</Badge>
                    </Link>
                    <Link href="/admin">
                        <Button variant="ghost">← Назад</Button>
                    </Link>
                </div>
            </header>

            <main className="container max-w-5xl mx-auto px-4 py-8">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold">Рекламные материалы</h1>
                    <p className="text-muted-foreground">Управление рекламой между вопросами</p>
                </div>

                {/* Upload Form */}
                <Card className="mb-8 card-elevated border-0 rounded-2xl">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <span className="text-xl">📤</span>
                            Загрузить рекламу
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleUpload} className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="title">Название</Label>
                                    <Input
                                        id="title"
                                        value={title}
                                        onChange={(e) => setTitle(e.target.value)}
                                        placeholder="Реклама продукта X"
                                        required
                                        className="h-11"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="media_type">Тип</Label>
                                    <select
                                        id="media_type"
                                        value={mediaType}
                                        onChange={(e) => setMediaType(e.target.value as 'image' | 'video')}
                                        className="w-full h-11 px-3 border rounded-lg bg-background"
                                    >
                                        <option value="image">Изображение</option>
                                        <option value="video">Видео</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="duration">Длительность (сек)</Label>
                                    <Input
                                        id="duration"
                                        type="number"
                                        min={3}
                                        max={30}
                                        value={duration}
                                        onChange={(e) => setDuration(Number(e.target.value))}
                                        className="h-11"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="file">Файл</Label>
                                    <Input
                                        id="file"
                                        type="file"
                                        accept={mediaType === 'video' ? 'video/mp4,video/webm' : 'image/*'}
                                        onChange={(e) => setFile(e.target.files?.[0] || null)}
                                        required
                                        className="h-11"
                                    />
                                </div>
                            </div>
                            <Button type="submit" className="btn-coral" disabled={isUploading}>
                                {isUploading ? 'Загрузка...' : 'Загрузить'}
                            </Button>
                        </form>
                    </CardContent>
                </Card>

                {/* Ads List */}
                <Card className="card-elevated border-0 rounded-2xl">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <span className="text-xl">📺</span>
                            Загруженные рекламы ({ads.length})
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? (
                            <div className="space-y-3">
                                {[...Array(3)].map((_, i) => (
                                    <Skeleton key={i} className="h-20 w-full rounded-xl" />
                                ))}
                            </div>
                        ) : ads.length === 0 ? (
                            <div className="text-center py-12">
                                <span className="text-5xl mb-4 block">📺</span>
                                <p className="text-muted-foreground">Нет загруженных реклам</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {ads.map((ad) => (
                                    <div
                                        key={ad.id}
                                        className="flex items-center gap-4 p-4 rounded-xl bg-secondary/30"
                                    >
                                        {/* Preview */}
                                        <div className="w-24 h-16 bg-muted rounded-lg overflow-hidden flex-shrink-0">
                                            {ad.media_type === 'video' ? (
                                                <video
                                                    src={`${API_URL}${ad.url}`}
                                                    className="w-full h-full object-cover"
                                                    muted
                                                />
                                            ) : (
                                                <img
                                                    src={`${API_URL}${ad.url}`}
                                                    alt={ad.title}
                                                    className="w-full h-full object-cover"
                                                />
                                            )}
                                        </div>

                                        {/* Info */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <h3 className="font-semibold truncate">{ad.title}</h3>
                                                <Badge className={ad.media_type === 'video' ? 'bg-blue-100 text-blue-700 border-0' : 'bg-green-100 text-green-700 border-0'}>
                                                    {ad.media_type === 'video' ? 'Видео' : 'Изображение'}
                                                </Badge>
                                            </div>
                                            <p className="text-sm text-muted-foreground">
                                                {ad.duration_sec} сек • {formatFileSize(ad.file_size_bytes)}
                                            </p>
                                        </div>

                                        {/* Actions */}
                                        <Button
                                            variant="destructive"
                                            size="sm"
                                            onClick={() => handleDelete(ad.id)}
                                        >
                                            Удалить
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </main>
        </div>
    );
}

export default function AdsPage() {
    return (
        <ProtectedRoute requireAdmin>
            <AdsManagement />
        </ProtectedRoute>
    );
}
