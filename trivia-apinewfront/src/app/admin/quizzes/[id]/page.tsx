'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { getQuizWithQuestions, scheduleQuiz, cancelQuiz, duplicateQuiz, addQuestions, QuizWithQuestions } from '@/lib/api';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { AdSlotsEditor } from '@/components/admin/AdSlotsEditor';
import { toast } from 'sonner';

const statusColors: Record<string, { bg: string; text: string; label: string }> = {
    scheduled: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Запланирована' },
    in_progress: { bg: 'bg-green-100', text: 'text-green-700', label: 'Идёт' },
    completed: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Завершена' },
    cancelled: { bg: 'bg-red-100', text: 'text-red-700', label: 'Отменена' },
    created: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Создана' },
};

interface QuestionFormData {
    text: string;
    options: string[];
    correct_option: number;
    time_limit_sec: number;
    point_value: number;
}

function QuizDetailsContent() {
    const params = useParams();
    const router = useRouter();
    const quizId = Number(params.id);

    const [quiz, setQuiz] = useState<QuizWithQuestions | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [showAddQuestions, setShowAddQuestions] = useState(false);
    const [showScheduleForm, setShowScheduleForm] = useState(false);
    const [showDuplicateForm, setShowDuplicateForm] = useState(false);
    const [scheduleTime, setScheduleTime] = useState('');
    const [duplicateTime, setDuplicateTime] = useState('');
    const [questions, setQuestions] = useState<QuestionFormData[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        const fetchQuiz = async () => {
            try {
                const data = await getQuizWithQuestions(quizId);
                setQuiz(data);
            } catch (error) {
                console.error('Failed to fetch quiz:', error);
                toast.error('Викторина не найдена');
                router.push('/admin');
            } finally {
                setIsLoading(false);
            }
        };

        fetchQuiz();
    }, [quizId, router]);

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleString('ru-RU');
    };

    const handleSchedule = async () => {
        if (!scheduleTime) {
            toast.error('Выберите время');
            return;
        }
        setIsSubmitting(true);
        try {
            await scheduleQuiz(quizId, new Date(scheduleTime).toISOString());
            toast.success('Время изменено');
            setShowScheduleForm(false);
            const data = await getQuizWithQuestions(quizId);
            setQuiz(data);
        } catch (error: unknown) {
            const err = error as { error?: string };
            toast.error(err.error || 'Ошибка изменения времени');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCancel = async () => {
        if (!confirm('Вы уверены, что хотите отменить викторину?')) return;
        try {
            await cancelQuiz(quizId);
            toast.success('Викторина отменена');
            const data = await getQuizWithQuestions(quizId);
            setQuiz(data);
        } catch (error: unknown) {
            const err = error as { error?: string };
            toast.error(err.error || 'Ошибка отмены');
        }
    };

    const handleDuplicate = async () => {
        if (!duplicateTime) {
            toast.error('Выберите время для копии');
            return;
        }
        setIsSubmitting(true);
        try {
            const newQuiz = await duplicateQuiz(quizId, new Date(duplicateTime).toISOString());
            toast.success('Викторина скопирована');
            router.push(`/admin/quizzes/${newQuiz.id}`);
        } catch (error: unknown) {
            const err = error as { error?: string };
            toast.error(err.error || 'Ошибка копирования');
        } finally {
            setIsSubmitting(false);
        }
    };

    const addEmptyQuestion = () => {
        setQuestions([...questions, {
            text: '',
            options: ['', '', '', ''],
            correct_option: 0,
            time_limit_sec: 15,
            point_value: 1,
        }]);
    };

    const updateQuestion = (index: number, field: keyof QuestionFormData, value: string | number | string[]) => {
        const updated = [...questions];
        if (field === 'text') {
            updated[index].text = value as string;
        } else if (field === 'options') {
            updated[index].options = value as string[];
        } else if (field === 'correct_option') {
            updated[index].correct_option = value as number;
        } else if (field === 'time_limit_sec') {
            updated[index].time_limit_sec = value as number;
        } else if (field === 'point_value') {
            updated[index].point_value = value as number;
        }
        setQuestions(updated);
    };

    const updateOption = (qIndex: number, oIndex: number, value: string) => {
        const updated = [...questions];
        updated[qIndex].options[oIndex] = value;
        setQuestions(updated);
    };

    const removeQuestion = (index: number) => {
        setQuestions(questions.filter((_, i) => i !== index));
    };

    const handleAddQuestions = async () => {
        for (let i = 0; i < questions.length; i++) {
            const q = questions[i];
            if (!q.text.trim()) {
                toast.error(`Вопрос ${i + 1}: Текст обязателен`);
                return;
            }
            const validOptions = q.options.filter(o => o.trim());
            if (validOptions.length < 2) {
                toast.error(`Вопрос ${i + 1}: Минимум 2 варианта ответа`);
                return;
            }
        }

        setIsSubmitting(true);
        try {
            await addQuestions(quizId, questions.map(q => ({
                ...q,
                options: q.options.filter(o => o.trim()),
            })));
            toast.success('Вопросы добавлены');
            setShowAddQuestions(false);
            setQuestions([]);
            const data = await getQuizWithQuestions(quizId);
            setQuiz(data);
        } catch (error: unknown) {
            const err = error as { error?: string };
            toast.error(err.error || 'Ошибка добавления вопросов');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen">
                <header className="border-b border-border/50 bg-white/80 backdrop-blur-sm">
                    <div className="container max-w-6xl mx-auto px-4 h-16 flex items-center">
                        <Skeleton className="h-8 w-32" />
                    </div>
                </header>
                <main className="container max-w-4xl mx-auto px-4 py-8">
                    <Skeleton className="h-8 w-48 mb-8" />
                    <Skeleton className="h-48 w-full rounded-2xl" />
                </main>
            </div>
        );
    }

    if (!quiz) return null;

    const canAddQuestions = ['scheduled', 'created'].includes(quiz.status);
    const canSchedule = quiz.status === 'scheduled' && (quiz.questions?.length ?? 0) > 0;
    const canCancel = quiz.status === 'scheduled';
    const canDuplicate = (quiz.questions?.length ?? 0) > 0;
    const canViewWinners = quiz.status === 'completed';

    const status = statusColors[quiz.status] || statusColors.scheduled;

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

            <main className="container max-w-4xl mx-auto px-4 py-8">
                {/* Title */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold">{quiz.title}</h1>
                    <div className="flex items-center gap-2 mt-2">
                        <Badge className={`${status.bg} ${status.text} border-0`}>{status.label}</Badge>
                        <span className="text-muted-foreground">{quiz.question_count} вопросов</span>
                    </div>
                </div>

                {/* Quiz Info */}
                <Card className="mb-6 card-elevated border-0 rounded-2xl">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <span className="text-xl">📋</span>
                            Детали викторины
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        {quiz.description && <p>{quiz.description}</p>}
                        <p><strong>Запланировано:</strong> {formatDate(quiz.scheduled_time)}</p>
                        <p><strong>Создано:</strong> {formatDate(quiz.created_at)}</p>
                    </CardContent>
                </Card>

                {/* Actions */}
                <Card className="mb-6 card-elevated border-0 rounded-2xl">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <span className="text-xl">⚡</span>
                            Действия
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-wrap gap-2">
                        {canAddQuestions && (
                            <Button className="btn-coral" onClick={() => { setShowAddQuestions(true); addEmptyQuestion(); }}>
                                + Добавить вопросы
                            </Button>
                        )}
                        {canSchedule && (
                            <Button variant="outline" onClick={() => setShowScheduleForm(true)}>
                                🕐 Перенести
                            </Button>
                        )}
                        {canCancel && (
                            <Button variant="destructive" onClick={handleCancel}>
                                Отменить
                            </Button>
                        )}
                        {canDuplicate && (
                            <Button variant="outline" onClick={() => setShowDuplicateForm(true)}>
                                📋 Копировать
                            </Button>
                        )}
                        {canViewWinners && (
                            <Link href={`/admin/quizzes/${quizId}/winners`}>
                                <Button className="bg-yellow-400 hover:bg-yellow-500 text-yellow-900">
                                    🏆 Победители
                                </Button>
                            </Link>
                        )}
                    </CardContent>
                </Card>

                {/* Schedule Form */}
                {showScheduleForm && (
                    <Card className="mb-6 card-elevated border-0 rounded-2xl">
                        <CardHeader>
                            <CardTitle>Перенести викторину</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <Label>Новое время</Label>
                                <Input type="datetime-local" value={scheduleTime} onChange={(e) => setScheduleTime(e.target.value)} className="h-11" />
                            </div>
                            <div className="flex gap-2">
                                <Button className="btn-coral" onClick={handleSchedule} disabled={isSubmitting}>Сохранить</Button>
                                <Button variant="ghost" onClick={() => setShowScheduleForm(false)}>Отмена</Button>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Duplicate Form */}
                {showDuplicateForm && (
                    <Card className="mb-6 card-elevated border-0 rounded-2xl">
                        <CardHeader>
                            <CardTitle>Копировать викторину</CardTitle>
                            <CardDescription>Создать копию с новым временем</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <Label>Время для копии</Label>
                                <Input type="datetime-local" value={duplicateTime} onChange={(e) => setDuplicateTime(e.target.value)} className="h-11" />
                            </div>
                            <div className="flex gap-2">
                                <Button className="btn-coral" onClick={handleDuplicate} disabled={isSubmitting}>Копировать</Button>
                                <Button variant="ghost" onClick={() => setShowDuplicateForm(false)}>Отмена</Button>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Add Questions Form */}
                {showAddQuestions && (
                    <Card className="mb-6 card-elevated border-0 rounded-2xl">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <span className="text-xl">❓</span>
                                Добавить вопросы
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {questions.map((q, qIndex) => (
                                <div key={qIndex} className="p-4 border rounded-xl bg-secondary/30 space-y-4">
                                    <div className="flex items-center justify-between">
                                        <h4 className="font-semibold">Вопрос {qIndex + 1}</h4>
                                        <Button variant="ghost" size="sm" onClick={() => removeQuestion(qIndex)} className="text-destructive">Удалить</Button>
                                    </div>
                                    <div>
                                        <Label>Текст вопроса</Label>
                                        <Input value={q.text} onChange={(e) => updateQuestion(qIndex, 'text', e.target.value)} placeholder="Какая столица Франции?" className="h-11" />
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        {q.options.map((opt, oIndex) => (
                                            <div key={oIndex}>
                                                <Label>Вариант {oIndex + 1}</Label>
                                                <Input value={opt} onChange={(e) => updateOption(qIndex, oIndex, e.target.value)} placeholder={`Вариант ${oIndex + 1}`} className="h-11" />
                                            </div>
                                        ))}
                                    </div>
                                    <div className="grid grid-cols-3 gap-4">
                                        <div>
                                            <Label>Верный ответ (0-3)</Label>
                                            <Input type="number" min={0} max={3} value={q.correct_option} onChange={(e) => updateQuestion(qIndex, 'correct_option', parseInt(e.target.value))} className="h-11" />
                                        </div>
                                        <div>
                                            <Label>Время (сек)</Label>
                                            <Input type="number" min={5} max={60} value={q.time_limit_sec} onChange={(e) => updateQuestion(qIndex, 'time_limit_sec', parseInt(e.target.value))} className="h-11" />
                                        </div>
                                        <div>
                                            <Label>Очки</Label>
                                            <Input type="number" min={1} value={q.point_value} onChange={(e) => updateQuestion(qIndex, 'point_value', parseInt(e.target.value))} className="h-11" />
                                        </div>
                                    </div>
                                </div>
                            ))}
                            <div className="flex gap-2">
                                <Button variant="outline" onClick={addEmptyQuestion}>+ Ещё вопрос</Button>
                                <Button className="btn-coral" onClick={handleAddQuestions} disabled={isSubmitting || questions.length === 0}>
                                    Сохранить вопросы
                                </Button>
                                <Button variant="ghost" onClick={() => { setShowAddQuestions(false); setQuestions([]); }}>Отмена</Button>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Ad Slots Editor */}
                {(quiz.questions?.length ?? 0) > 0 && (
                    <div className="mb-6">
                        <AdSlotsEditor quizId={quizId} questionCount={quiz.questions?.length ?? 0} />
                    </div>
                )}

                {/* Existing Questions */}
                <Card className="card-elevated border-0 rounded-2xl">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <span className="text-xl">📝</span>
                            Вопросы ({quiz.questions?.length ?? 0})
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {(quiz.questions?.length ?? 0) === 0 ? (
                            <div className="text-center py-12">
                                <span className="text-5xl mb-4 block">❓</span>
                                <p className="text-muted-foreground">Вопросов пока нет. Добавьте их выше!</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {quiz.questions?.map((q, i) => (
                                    <div key={q.id} className="p-4 border rounded-xl bg-secondary/30">
                                        <p className="font-medium mb-2">В{i + 1}: {q.text}</p>
                                        <div className="grid grid-cols-2 gap-2 text-sm">
                                            {q.options.map((opt, j) => (
                                                <div key={j} className="p-2 rounded-lg bg-muted">
                                                    {String.fromCharCode(65 + j)}. {opt.text}
                                                </div>
                                            ))}
                                        </div>
                                        <p className="text-xs text-muted-foreground mt-2">
                                            Время: {q.time_limit_sec} сек • Очки: {q.point_value}
                                        </p>
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

export default function QuizDetailsPage() {
    return (
        <ProtectedRoute requireAdmin>
            <QuizDetailsContent />
        </ProtectedRoute>
    );
}
