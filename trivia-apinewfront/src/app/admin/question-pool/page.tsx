'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { Button } from '@/components/ui/button';
import { BackButton } from '@/components/BackButton';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { api } from '@/lib/api/client';

interface PoolQuestion {
    text: string;
    options: string[];
    correct_option: number;
    difficulty: number;
    time_limit_sec?: number;
    point_value?: number;
}

interface UploadResponse {
    message: string;
    count: number;
}

interface PoolStats {
    total: number;
    used: number;
    available: number;
    by_difficulty: Record<number, number>;
}

function QuestionPoolContent() {
    const [jsonInput, setJsonInput] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [preview, setPreview] = useState<PoolQuestion[] | null>(null);
    const [parseError, setParseError] = useState<string | null>(null);
    const [stats, setStats] = useState<PoolStats | null>(null);
    const [isResetting, setIsResetting] = useState(false);

    const loadStats = useCallback(async () => {
        try {
            const data = await api.get<PoolStats>('/api/admin/question-pool/stats');
            setStats(data);
        } catch {
            console.error('Failed to load pool stats');
        }
    }, []);

    useEffect(() => {
        loadStats();
    }, [loadStats]);

    const handleReset = async () => {
        if (!confirm('Сбросить флаг is_used для всех вопросов пула? Это позволит использовать все вопросы повторно.')) return;
        setIsResetting(true);
        try {
            const result = await api.post<{ count: number }>('/api/admin/question-pool/reset', {});
            toast.success(`Сброшено ${result.count} вопросов`);
            loadStats();
        } catch {
            toast.error('Ошибка сброса');
        } finally {
            setIsResetting(false);
        }
    };

    const handleParsePreview = () => {
        try {
            const parsed = JSON.parse(jsonInput);
            const questions = Array.isArray(parsed) ? parsed : parsed.questions;

            if (!Array.isArray(questions) || questions.length === 0) {
                setParseError('JSON должен содержать массив вопросов или объект с полем "questions"');
                setPreview(null);
                return;
            }

            // Валидация каждого вопроса
            for (let i = 0; i < questions.length; i++) {
                const q = questions[i];
                if (!q.text?.trim()) {
                    setParseError(`Вопрос ${i + 1}: отсутствует text`);
                    setPreview(null);
                    return;
                }
                if (!Array.isArray(q.options) || q.options.length < 2) {
                    setParseError(`Вопрос ${i + 1}: нужно минимум 2 варианта ответа`);
                    setPreview(null);
                    return;
                }
                if (q.correct_option === undefined || q.correct_option < 0 || q.correct_option >= q.options.length) {
                    setParseError(`Вопрос ${i + 1}: некорректный correct_option (должен быть 0-${q.options.length - 1})`);
                    setPreview(null);
                    return;
                }
                if (!q.difficulty || q.difficulty < 1 || q.difficulty > 5) {
                    setParseError(`Вопрос ${i + 1}: difficulty обязателен (1-5)`);
                    setPreview(null);
                    return;
                }
            }

            setPreview(questions);
            setParseError(null);
        } catch {
            setParseError('Некорректный JSON');
            setPreview(null);
        }
    };

    const handleUpload = async () => {
        if (!preview || preview.length === 0) {
            toast.error('Сначала проверьте JSON');
            return;
        }

        setIsSubmitting(true);
        try {
            const response = await api.post<UploadResponse>('/api/admin/question-pool', {
                questions: preview,
            });
            toast.success(`Загружено ${response.count || preview.length} вопросов!`);
            setJsonInput('');
            setPreview(null);
            loadStats(); // Обновляем статистику
        } catch (error: unknown) {
            const err = error as { error?: string };
            toast.error(err.error || 'Ошибка загрузки');
        } finally {
            setIsSubmitting(false);
        }
    };

    const difficultyLabels: Record<number, { label: string; color: string }> = {
        1: { label: 'Очень легко', color: 'bg-green-100 text-green-700' },
        2: { label: 'Легко', color: 'bg-lime-100 text-lime-700' },
        3: { label: 'Средне', color: 'bg-yellow-100 text-yellow-700' },
        4: { label: 'Сложно', color: 'bg-orange-100 text-orange-700' },
        5: { label: 'Очень сложно', color: 'bg-red-100 text-red-700' },
    };

    const exampleJson = `[
  {
    "text": "Какой город является столицей Казахстана?",
    "options": ["Алматы", "Астана", "Караганда", "Шымкент"],
    "correct_option": 1,
    "difficulty": 1
  },
  {
    "text": "В каком году Казахстан обрел независимость?",
    "options": ["1989", "1990", "1991", "1992"],
    "correct_option": 2,
    "difficulty": 2
  }
]`;

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
                    <BackButton href="/admin" label="Назад" />
                </div>
            </header>

            {/* Main */}
            <main className="container max-w-4xl mx-auto px-4 py-8">
                <h1 className="text-3xl font-bold mb-6 flex items-center gap-3">
                    <span className="text-3xl"></span>
                    Пул вопросов для адаптивной системы
                </h1>

                {/* Info */}
                <Card className="mb-6 card-elevated border-0 rounded-2xl bg-blue-50">
                    <CardContent className="pt-6">
                        <p className="text-sm text-blue-800">
                            <strong>Что это?</strong> Эти вопросы используются адаптивной системой сложности.
                            В отличие от вопросов привязанных к викторине, эти вопросы хранятся в общем пуле
                            и выбираются динамически во время игры на основе сложности.
                        </p>
                    </CardContent>
                </Card>

                {/* Pool Stats */}
                {stats && (
                    <Card className="mb-6 card-elevated border-0 rounded-2xl">
                        <CardHeader>
                            <CardTitle className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <span className="text-xl"></span>
                                    Статистика пула
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleReset}
                                    disabled={isResetting || stats.used === 0}
                                >
                                    {isResetting ? 'Сброс...' : ' Сбросить is_used'}
                                </Button>
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-3 gap-4 mb-4">
                                <div className="text-center p-4 bg-secondary/50 rounded-xl">
                                    <div className="text-3xl font-bold text-primary">{stats.total}</div>
                                    <div className="text-sm text-muted-foreground">Всего</div>
                                </div>
                                <div className="text-center p-4 bg-green-50 rounded-xl">
                                    <div className="text-3xl font-bold text-green-600">{stats.available}</div>
                                    <div className="text-sm text-muted-foreground">Доступно</div>
                                </div>
                                <div className="text-center p-4 bg-orange-50 rounded-xl">
                                    <div className="text-3xl font-bold text-orange-600">{stats.used}</div>
                                    <div className="text-sm text-muted-foreground">Использовано</div>
                                </div>
                            </div>
                            {stats.by_difficulty && Object.keys(stats.by_difficulty).length > 0 && (
                                <div className="grid grid-cols-5 gap-2 text-center text-sm">
                                    {[1, 2, 3, 4, 5].map(d => (
                                        <div key={d} className={`p-2 rounded-lg ${difficultyLabels[d]?.color || 'bg-gray-100'}`}>
                                            <div className="font-bold">{stats.by_difficulty[d] || 0}</div>
                                            <div className="text-xs">{difficultyLabels[d]?.label}</div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}

                {/* JSON Input */}
                <Card className="mb-6 card-elevated border-0 rounded-2xl">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <span className="text-xl"></span>
                            Загрузка вопросов (JSON)
                        </CardTitle>
                        <CardDescription>
                            Вставьте JSON с массивом вопросов. Поле <code className="bg-muted px-1 rounded">difficulty</code> (1-5) обязательно.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <Label>JSON вопросов</Label>
                            <textarea
                                value={jsonInput}
                                onChange={(e) => setJsonInput(e.target.value)}
                                placeholder={exampleJson}
                                className="w-full h-64 p-3 rounded-md border border-input bg-background font-mono text-sm resize-none"
                            />
                        </div>

                        {parseError && (
                            <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm">
                                 {parseError}
                            </div>
                        )}

                        <div className="flex gap-2">
                            <Button variant="outline" onClick={handleParsePreview} disabled={!jsonInput.trim()}>
                                 Предпросмотр
                            </Button>
                            <Button
                                className="btn-coral"
                                onClick={handleUpload}
                                disabled={!preview || isSubmitting}
                            >
                                {isSubmitting ? 'Загрузка...' : ` Загрузить ${preview?.length || 0} вопросов`}
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* Preview */}
                {preview && preview.length > 0 && (
                    <Card className="card-elevated border-0 rounded-2xl">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <span className="text-xl"></span>
                                Предпросмотр ({preview.length} вопросов)
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4 max-h-96 overflow-y-auto">
                                {preview.map((q, i) => (
                                    <div key={i} className="p-4 border rounded-xl bg-secondary/30">
                                        <div className="flex items-start justify-between mb-2">
                                            <p className="font-medium">В{i + 1}: {q.text}</p>
                                            <Badge className={difficultyLabels[q.difficulty]?.color || 'bg-gray-100'}>
                                                {difficultyLabels[q.difficulty]?.label || `Сложность ${q.difficulty}`}
                                            </Badge>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2 text-sm">
                                            {q.options.map((opt, j) => (
                                                <div
                                                    key={j}
                                                    className={`p-2 rounded-lg ${j === q.correct_option ? 'bg-green-100 text-green-800 font-medium' : 'bg-muted'}`}
                                                >
                                                    {String.fromCharCode(65 + j)}. {opt}
                                                    {j === q.correct_option && ' '}
                                                </div>
                                            ))}
                                        </div>
                                        {(q.time_limit_sec || q.point_value) && (
                                            <div className="mt-2 text-xs text-muted-foreground">
                                                {q.time_limit_sec && ` ${q.time_limit_sec} сек`}
                                                {q.time_limit_sec && q.point_value && ' | '}
                                                {q.point_value && ` ${q.point_value} очков`}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Format Info */}
                <Card className="mt-6 border-0 rounded-2xl bg-muted/50">
                    <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                            <span></span>
                            Формат JSON
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <pre className="text-xs bg-slate-900 text-slate-100 p-4 rounded-lg overflow-x-auto">
                            {`{
  "text": "Текст вопроса",               // обязательно
  "options": ["A", "B", "C", "D"],       // обязательно (мин. 2)
  "correct_option": 0,                   // обязательно (0-N)
  "difficulty": 3,                       // обязательно (1-5)
  "time_limit_sec": 10,                  // опционально (дефолт: 10)
  "point_value": 1                       // опционально (дефолт: 1)
}`}
                        </pre>
                        <div className="mt-4 grid grid-cols-5 gap-2 text-center text-xs">
                            {[1, 2, 3, 4, 5].map(d => (
                                <div key={d} className={`p-2 rounded-lg ${difficultyLabels[d].color}`}>
                                    {d}: {difficultyLabels[d].label}
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </main>
        </div>
    );
}

export default function QuestionPoolPage() {
    return (
        <ProtectedRoute requireAdmin>
            <QuestionPoolContent />
        </ProtectedRoute>
    );
}
