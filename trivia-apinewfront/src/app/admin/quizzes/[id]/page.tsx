'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { getQuizWithQuestions, getQuizAskedQuestions, scheduleQuiz, cancelQuiz, duplicateQuiz, addQuestions, QuizWithQuestions, AskedQuizQuestion } from '@/lib/api';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/formatCurrency';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { AdSlotsEditor } from '@/components/admin/AdSlotsEditor';
import { BackButton } from '@/components/BackButton';
import { formatDate } from '@/lib/formatDate';
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
    text_kk: string; // Казахский текст (опционально)
    options: string[];
    options_kk: string[]; // Казахские варианты (опционально)
    correct_option: number;
    time_limit_sec: number;
    point_value: number;
    difficulty: number; // Уровень сложности 1-5
}

function QuizDetailsContent() {
    const params = useParams();
    const router = useRouter();
    const quizId = Number(params.id);

    const [quiz, setQuiz] = useState<QuizWithQuestions | null>(null);
    const [askedQuestions, setAskedQuestions] = useState<AskedQuizQuestion[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showAddQuestions, setShowAddQuestions] = useState(false);
    const [showScheduleForm, setShowScheduleForm] = useState(false);
    const [showDuplicateForm, setShowDuplicateForm] = useState(false);
    const [scheduleTime, setScheduleTime] = useState('');
    const [scheduleFinishOnZeroPlayers, setScheduleFinishOnZeroPlayers] = useState(false);
    const [duplicateTime, setDuplicateTime] = useState('');
    const [questions, setQuestions] = useState<QuestionFormData[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const loadQuiz = async (showErrorToast = true) => {
        try {
            const [data, asked] = await Promise.all([
                getQuizWithQuestions(quizId),
                getQuizAskedQuestions(quizId).catch((err) => {
                    console.warn('Failed to fetch asked questions:', err);
                    return [] as AskedQuizQuestion[];
                }),
            ]);

            setQuiz(data);
            setAskedQuestions(asked);
            setScheduleFinishOnZeroPlayers(data.finish_on_zero_players ?? false);
        } catch (error) {
            console.error('Failed to fetch quiz:', error);
            if (showErrorToast) {
                toast.error('Викторина не найдена');
            }
            router.push('/admin');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadQuiz();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [quizId]);



    const handleSchedule = async () => {
        if (!scheduleTime) {
            toast.error('Выберите время');
            return;
        }
        setIsSubmitting(true);
        try {
            await scheduleQuiz(quizId, new Date(scheduleTime).toISOString(), scheduleFinishOnZeroPlayers);
            toast.success('Время изменено');
            setShowScheduleForm(false);
            await loadQuiz(false);
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
            await loadQuiz(false);
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
            text_kk: '',
            options: ['', '', '', ''],
            options_kk: ['', '', '', ''],
            correct_option: 0,
            time_limit_sec: 10,
            point_value: 1,
            difficulty: 3, // По умолчанию Medium
        }]);
    };

    const updateQuestion = (index: number, field: keyof QuestionFormData, value: string | number | string[]) => {
        const updated = [...questions];
        if (field === 'text') {
            updated[index].text = value as string;
        } else if (field === 'text_kk') {
            updated[index].text_kk = value as string;
        } else if (field === 'options') {
            updated[index].options = value as string[];
        } else if (field === 'options_kk') {
            updated[index].options_kk = value as string[];
        } else if (field === 'correct_option') {
            updated[index].correct_option = value as number;
        } else if (field === 'time_limit_sec') {
            updated[index].time_limit_sec = value as number;
        } else if (field === 'point_value') {
            updated[index].point_value = value as number;
        } else if (field === 'difficulty') {
            updated[index].difficulty = value as number;
        }
        setQuestions(updated);
    };

    const updateOption = (qIndex: number, oIndex: number, value: string) => {
        const updated = [...questions];
        updated[qIndex].options[oIndex] = value;
        setQuestions(updated);
    };

    const updateOptionKK = (qIndex: number, oIndex: number, value: string) => {
        const updated = [...questions];
        updated[qIndex].options_kk[oIndex] = value;
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
                // Фильтруем и отправляем kk поля только если они заполнены
                text_kk: q.text_kk?.trim() || undefined,
                options_kk: q.options_kk?.filter(o => o.trim()).length > 0
                    ? q.options_kk.filter(o => o.trim())
                    : undefined,
            })));
            toast.success('Вопросы добавлены');
            setShowAddQuestions(false);
            setQuestions([]);
            await loadQuiz(false);
        } catch (error: unknown) {
            const err = error as { error?: string };
            toast.error(err.error || 'Ошибка добавления вопросов');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-app">
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
    const canSchedule = quiz.status === 'scheduled';
    const canCancel = quiz.status === 'scheduled';
    const canDuplicate = (quiz.questions?.length ?? 0) > 0;
    const canViewWinners = quiz.status === 'completed';

    const status = statusColors[quiz.status] || statusColors.scheduled;

    return (
        <div className="min-h-app">
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
                    <BackButton href="/admin" />
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
                            <span className="text-xl"></span>
                            Детали викторины
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        {quiz.description && <p>{quiz.description}</p>}
                        <p><strong>Запланировано:</strong> {formatDate(quiz.scheduled_time)}</p>
                        <p><strong>Призовой фонд:</strong> <span className="text-green-600 font-semibold">{formatCurrency(quiz.prize_fund || 0)}</span></p>
                        <p><strong>Поведение при 0 активных игроков:</strong> {quiz.finish_on_zero_players ? 'досрочно завершать' : 'идти до конца'}</p>
                        <p><strong>Создано:</strong> {formatDate(quiz.created_at)}</p>
                    </CardContent>
                </Card>

                {/* Actions */}
                <Card className="mb-6 card-elevated border-0 rounded-2xl">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <span className="text-xl"></span>
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
                                 Перенести
                            </Button>
                        )}
                        {canCancel && (
                            <Button variant="destructive" onClick={handleCancel}>
                                Отменить
                            </Button>
                        )}
                        {canDuplicate && (
                            <Button variant="outline" onClick={() => setShowDuplicateForm(true)}>
                                 Копировать
                            </Button>
                        )}
                        {canViewWinners && (
                            <>
                                <Button asChild className="bg-yellow-400 hover:bg-yellow-500 text-yellow-900">
                                    <Link href={`/admin/quizzes/${quizId}/winners`}> Победители</Link>
                                </Button>
                                <Button asChild variant="outline" className="border-purple-300 text-purple-700 hover:bg-purple-50">
                                    <Link href={`/admin/quizzes/${quizId}/statistics`}> Статистика</Link>
                                </Button>
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        window.open(`${process.env.NEXT_PUBLIC_API_URL}/api/quizzes/${quizId}/results/export?format=csv`, '_blank');
                                    }}
                                >
                                     CSV
                                </Button>
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        window.open(`${process.env.NEXT_PUBLIC_API_URL}/api/quizzes/${quizId}/results/export?format=xlsx`, '_blank');
                                    }}
                                >
                                     Excel
                                </Button>
                            </>
                        )}
                        {/* Live мониторинг — доступен для scheduled и in_progress */}
                        {(quiz.status === 'scheduled' || quiz.status === 'in_progress') && (
                            <Button asChild variant="outline" className="border-green-300 text-green-700 hover:bg-green-50">
                                <Link href={`/admin/quiz-live/${quizId}`}> Live мониторинг</Link>
                            </Button>
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
                            <div>
                                <Label className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        checked={scheduleFinishOnZeroPlayers}
                                        onChange={(e) => setScheduleFinishOnZeroPlayers(e.target.checked)}
                                    />
                                    Завершать викторину, если активных игроков стало 0
                                </Label>
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
                                <span className="text-xl"></span>
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

                                    {/* Казахский текст (опционально) */}
                                    <div className="border-t border-border pt-4 mt-2">
                                        <p className="text-sm text-muted-foreground mb-2">KZ: Казахский текст (опционально)</p>
                                        <div>
                                            <Label>Сұрақ мәтіні (KZ)</Label>
                                            <Input value={q.text_kk} onChange={(e) => updateQuestion(qIndex, 'text_kk', e.target.value)} placeholder="Казахский текст вопроса" className="h-11" />
                                        </div>
                                        <div className="grid grid-cols-2 gap-2 mt-2">
                                            {q.options_kk.map((opt, oIndex) => (
                                                <div key={oIndex}>
                                                    <Label>Нұсқа {oIndex + 1} (KZ)</Label>
                                                    <Input value={opt} onChange={(e) => updateOptionKK(qIndex, oIndex, e.target.value)} placeholder={`Вариант ${oIndex + 1} на казахском`} className="h-11" />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-4 gap-4">
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
                                        <div>
                                            <Label>Сложность</Label>
                                            <select
                                                value={q.difficulty}
                                                onChange={(e) => updateQuestion(qIndex, 'difficulty', parseInt(e.target.value))}
                                                className="w-full h-11 px-3 rounded-md border border-input bg-background"
                                            >
                                                <option value={1}>1 - Очень легко</option>
                                                <option value={2}>2 - Легко</option>
                                                <option value={3}>3 - Средне</option>
                                                <option value={4}>4 - Сложно</option>
                                                <option value={5}>5 - Очень сложно</option>
                                            </select>
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

                {/* Asked Questions History */}
                <Card className="mb-6 card-elevated border-0 rounded-2xl">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <span className="text-xl"></span>
                            Фактически заданные вопросы ({askedQuestions.length})
                        </CardTitle>
                        <CardDescription>
                            История проведения викторины: порядок, ID, сложность и правильные ответы.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {askedQuestions.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                                История пока пуста. Она появится после начала викторины.
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {askedQuestions.map((item) => (
                                    <div key={`${item.question_order}-${item.question.id}`} className="p-4 border rounded-xl bg-secondary/30">
                                        <div className="flex flex-wrap items-center gap-2 mb-2">
                                            <Badge variant="outline">#{item.question_order}</Badge>
                                            <Badge variant="outline">ID: {item.question.id}</Badge>
                                            <Badge variant={item.source === 'pool' ? 'secondary' : 'default'}>
                                                {item.source === 'pool' ? 'Из пула' : 'Из викторины'}
                                            </Badge>
                                        </div>
                                        <p className="font-medium mb-2">{item.question.text}</p>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                                            {item.question.options.map((opt) => (
                                                <div
                                                    key={opt.id}
                                                    className={`p-2 rounded-lg ${opt.id === item.question.correct_option ? 'bg-green-100 border border-green-300' : 'bg-muted'}`}
                                                >
                                                    {String.fromCharCode(65 + opt.id)}. {opt.text}
                                                    {opt.id === item.question.correct_option && <span className="ml-2 text-green-700 font-semibold"></span>}
                                                </div>
                                            ))}
                                        </div>
                                        <p className="text-xs text-muted-foreground mt-2">
                                            Сложность: {item.question.difficulty} • Время: {item.question.time_limit_sec} сек • Очки: {item.question.point_value}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Existing Questions */}
                <Card className="card-elevated border-0 rounded-2xl">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <span className="text-xl"></span>
                            Вопросы, добавленные в викторину ({quiz.questions?.length ?? 0})
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {(quiz.questions?.length ?? 0) === 0 ? (
                            <div className="text-center py-12">
                                <span className="text-5xl mb-4 block"></span>
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
