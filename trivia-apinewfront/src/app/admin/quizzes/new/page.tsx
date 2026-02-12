'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createQuiz } from '@/lib/api';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

function CreateQuizForm() {
    const router = useRouter();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [scheduledTime, setScheduledTime] = useState('');
    const [prizeFund, setPrizeFund] = useState(1000000);
    const [finishOnZeroPlayers, setFinishOnZeroPlayers] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!title.trim()) {
            toast.error('Название обязательно');
            return;
        }

        if (!scheduledTime) {
            toast.error('Укажите время начала');
            return;
        }

        if (new Date(scheduledTime) <= new Date()) {
            toast.error('Время должно быть в будущем');
            return;
        }

        setIsSubmitting(true);
        try {
            const quiz = await createQuiz({
                title: title.trim(),
                description: description.trim() || undefined,
                scheduled_time: new Date(scheduledTime).toISOString(),
                prize_fund: prizeFund > 0 ? prizeFund : undefined,
                finish_on_zero_players: finishOnZeroPlayers,
            });

            toast.success('Викторина создана!');
            router.push(`/admin/quizzes/${quiz.id}`);
        } catch (error: unknown) {
            const err = error as { error?: string };
            toast.error(err.error || 'Ошибка создания викторины');
        } finally {
            setIsSubmitting(false);
        }
    };

    const getDefaultDateTime = () => {
        const date = new Date();
        date.setHours(date.getHours() + 1);
        return date.toISOString().slice(0, 16);
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

            <main className="container max-w-2xl mx-auto px-4 py-8">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold">Создать викторину</h1>
                    <p className="text-muted-foreground">Заполните основную информацию</p>
                </div>

                <Card className="card-elevated border-0 rounded-2xl">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <span className="text-xl">✏️</span>
                            Детали викторины
                        </CardTitle>
                        <CardDescription>После создания вы сможете добавить вопросы</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="space-y-2">
                                <Label htmlFor="title">Название *</Label>
                                <Input
                                    id="title"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="Вечерняя викторина"
                                    required
                                    minLength={3}
                                    maxLength={100}
                                    className="h-12"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="description">Описание</Label>
                                <Input
                                    id="description"
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="Проверь свои знания и выиграй призы!"
                                    maxLength={500}
                                    className="h-12"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="scheduledTime">Время начала *</Label>
                                <Input
                                    id="scheduledTime"
                                    type="datetime-local"
                                    value={scheduledTime || getDefaultDateTime()}
                                    onChange={(e) => setScheduledTime(e.target.value)}
                                    required
                                    className="h-12"
                                />
                                <p className="text-xs text-muted-foreground">
                                    Викторина начнётся автоматически в это время
                                </p>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="prizeFund">Призовой фонд</Label>
                                <Input
                                    id="prizeFund"
                                    type="number"
                                    value={prizeFund}
                                    onChange={(e) => setPrizeFund(parseInt(e.target.value) || 0)}
                                    min={0}
                                    className="h-12"
                                />
                                <p className="text-xs text-muted-foreground">
                                    Сумма делится поровну между всеми победителями
                                </p>
                            </div>

                            <div className="space-y-2">
                                <Label className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        checked={finishOnZeroPlayers}
                                        onChange={(e) => setFinishOnZeroPlayers(e.target.checked)}
                                    />
                                    Завершать викторину, если активных игроков стало 0
                                </Label>
                                <p className="text-xs text-muted-foreground">
                                    Если выключено, викторина дойдет до конца даже без активных игроков.
                                </p>
                            </div>

                            <div className="flex gap-4 pt-4">
                                <Button type="submit" disabled={isSubmitting} className="flex-1 btn-coral h-12">
                                    {isSubmitting ? 'Создаём...' : 'Создать викторину'}
                                </Button>
                                <Link href="/admin" className="flex-1">
                                    <Button type="button" variant="outline" className="w-full h-12">
                                        Отмена
                                    </Button>
                                </Link>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            </main>
        </div>
    );
}

export default function CreateQuizPage() {
    return (
        <ProtectedRoute requireAdmin>
            <CreateQuizForm />
        </ProtectedRoute>
    );
}
