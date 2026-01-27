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

const statusColors: Record<string, string> = {
    scheduled: 'bg-blue-500',
    in_progress: 'bg-green-500',
    completed: 'bg-gray-500',
    cancelled: 'bg-red-500',
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
                toast.error('Quiz not found');
                router.push('/admin');
            } finally {
                setIsLoading(false);
            }
        };

        fetchQuiz();
    }, [quizId, router]);

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleString();
    };

    const handleSchedule = async () => {
        if (!scheduleTime) {
            toast.error('Please select a time');
            return;
        }
        setIsSubmitting(true);
        try {
            await scheduleQuiz(quizId, new Date(scheduleTime).toISOString());
            toast.success('Quiz scheduled successfully');
            setShowScheduleForm(false);
            const data = await getQuizWithQuestions(quizId);
            setQuiz(data);
        } catch (error: unknown) {
            const err = error as { error?: string };
            toast.error(err.error || 'Failed to schedule quiz');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCancel = async () => {
        if (!confirm('Are you sure you want to cancel this quiz?')) return;
        try {
            await cancelQuiz(quizId);
            toast.success('Quiz cancelled');
            const data = await getQuizWithQuestions(quizId);
            setQuiz(data);
        } catch (error: unknown) {
            const err = error as { error?: string };
            toast.error(err.error || 'Failed to cancel quiz');
        }
    };

    const handleDuplicate = async () => {
        if (!duplicateTime) {
            toast.error('Please select a time for the duplicate');
            return;
        }
        setIsSubmitting(true);
        try {
            const newQuiz = await duplicateQuiz(quizId, new Date(duplicateTime).toISOString());
            toast.success('Quiz duplicated successfully');
            router.push(`/admin/quizzes/${newQuiz.id}`);
        } catch (error: unknown) {
            const err = error as { error?: string };
            toast.error(err.error || 'Failed to duplicate quiz');
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
        // Validate
        for (let i = 0; i < questions.length; i++) {
            const q = questions[i];
            if (!q.text.trim()) {
                toast.error(`Question ${i + 1}: Text is required`);
                return;
            }
            const validOptions = q.options.filter(o => o.trim());
            if (validOptions.length < 2) {
                toast.error(`Question ${i + 1}: At least 2 options required`);
                return;
            }
        }

        setIsSubmitting(true);
        try {
            await addQuestions(quizId, questions.map(q => ({
                ...q,
                options: q.options.filter(o => o.trim()),
            })));
            toast.success('Questions added successfully');
            setShowAddQuestions(false);
            setQuestions([]);
            const data = await getQuizWithQuestions(quizId);
            setQuiz(data);
        } catch (error: unknown) {
            const err = error as { error?: string };
            toast.error(err.error || 'Failed to add questions');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isLoading) {
        return (
            <main className="container max-w-4xl mx-auto px-4 py-12">
                <Skeleton className="h-8 w-48 mb-8" />
                <Skeleton className="h-48 w-full" />
            </main>
        );
    }

    if (!quiz) return null;

    const canAddQuestions = ['scheduled', 'created'].includes(quiz.status);
    const canSchedule = quiz.status === 'scheduled' && (quiz.questions?.length ?? 0) > 0;
    const canCancel = quiz.status === 'scheduled';
    const canDuplicate = (quiz.questions?.length ?? 0) > 0;
    const canViewWinners = quiz.status === 'completed';

    return (
        <main className="container max-w-4xl mx-auto px-4 py-12">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold">{quiz.title}</h1>
                    <div className="flex items-center gap-2 mt-2">
                        <Badge className={statusColors[quiz.status]}>{quiz.status}</Badge>
                        <span className="text-muted-foreground">{quiz.question_count} questions</span>
                    </div>
                </div>
                <Link href="/admin">
                    <Button variant="ghost">← Back</Button>
                </Link>
            </div>

            {/* Quiz Info */}
            <Card className="mb-6">
                <CardHeader>
                    <CardTitle>Quiz Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                    {quiz.description && <p>{quiz.description}</p>}
                    <p><strong>Scheduled:</strong> {formatDate(quiz.scheduled_time)}</p>
                    <p><strong>Created:</strong> {formatDate(quiz.created_at)}</p>
                </CardContent>
            </Card>

            {/* Actions */}
            <Card className="mb-6">
                <CardHeader>
                    <CardTitle>Actions</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                    {canAddQuestions && (
                        <Button onClick={() => { setShowAddQuestions(true); addEmptyQuestion(); }}>
                            + Add Questions
                        </Button>
                    )}
                    {canSchedule && (
                        <Button variant="outline" onClick={() => setShowScheduleForm(true)}>
                            Reschedule
                        </Button>
                    )}
                    {canCancel && (
                        <Button variant="destructive" onClick={handleCancel}>
                            Cancel Quiz
                        </Button>
                    )}
                    {canDuplicate && (
                        <Button variant="outline" onClick={() => setShowDuplicateForm(true)}>
                            Duplicate
                        </Button>
                    )}
                    {canViewWinners && (
                        <Link href={`/admin/quizzes/${quizId}/winners`}>
                            <Button variant="default" className="bg-yellow-500 hover:bg-yellow-600">
                                🏆 View Winners
                            </Button>
                        </Link>
                    )}
                </CardContent>
            </Card>

            {/* Schedule Form */}
            {showScheduleForm && (
                <Card className="mb-6">
                    <CardHeader>
                        <CardTitle>Reschedule Quiz</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <Label>New Time</Label>
                            <Input type="datetime-local" value={scheduleTime} onChange={(e) => setScheduleTime(e.target.value)} />
                        </div>
                        <div className="flex gap-2">
                            <Button onClick={handleSchedule} disabled={isSubmitting}>Save</Button>
                            <Button variant="ghost" onClick={() => setShowScheduleForm(false)}>Cancel</Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Duplicate Form */}
            {showDuplicateForm && (
                <Card className="mb-6">
                    <CardHeader>
                        <CardTitle>Duplicate Quiz</CardTitle>
                        <CardDescription>Create a copy with a new scheduled time</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <Label>Scheduled Time for Duplicate</Label>
                            <Input type="datetime-local" value={duplicateTime} onChange={(e) => setDuplicateTime(e.target.value)} />
                        </div>
                        <div className="flex gap-2">
                            <Button onClick={handleDuplicate} disabled={isSubmitting}>Duplicate</Button>
                            <Button variant="ghost" onClick={() => setShowDuplicateForm(false)}>Cancel</Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Add Questions Form */}
            {showAddQuestions && (
                <Card className="mb-6">
                    <CardHeader>
                        <CardTitle>Add Questions</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {questions.map((q, qIndex) => (
                            <div key={qIndex} className="p-4 border rounded-lg space-y-4">
                                <div className="flex items-center justify-between">
                                    <h4 className="font-semibold">Question {qIndex + 1}</h4>
                                    <Button variant="ghost" size="sm" onClick={() => removeQuestion(qIndex)}>Remove</Button>
                                </div>
                                <div>
                                    <Label>Question Text</Label>
                                    <Input value={q.text} onChange={(e) => updateQuestion(qIndex, 'text', e.target.value)} placeholder="What is the capital of France?" />
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    {q.options.map((opt, oIndex) => (
                                        <div key={oIndex}>
                                            <Label>Option {oIndex + 1}</Label>
                                            <Input value={opt} onChange={(e) => updateOption(qIndex, oIndex, e.target.value)} placeholder={`Option ${oIndex + 1}`} />
                                        </div>
                                    ))}
                                </div>
                                <div className="grid grid-cols-3 gap-4">
                                    <div>
                                        <Label>Correct Option (0-3)</Label>
                                        <Input type="number" min={0} max={3} value={q.correct_option} onChange={(e) => updateQuestion(qIndex, 'correct_option', parseInt(e.target.value))} />
                                    </div>
                                    <div>
                                        <Label>Time Limit (sec)</Label>
                                        <Input type="number" min={5} max={60} value={q.time_limit_sec} onChange={(e) => updateQuestion(qIndex, 'time_limit_sec', parseInt(e.target.value))} />
                                    </div>
                                    <div>
                                        <Label>Points</Label>
                                        <Input type="number" min={1} value={q.point_value} onChange={(e) => updateQuestion(qIndex, 'point_value', parseInt(e.target.value))} />
                                    </div>
                                </div>
                            </div>
                        ))}
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={addEmptyQuestion}>+ Add Another</Button>
                            <Button onClick={handleAddQuestions} disabled={isSubmitting || questions.length === 0}>
                                Save Questions
                            </Button>
                            <Button variant="ghost" onClick={() => { setShowAddQuestions(false); setQuestions([]); }}>Cancel</Button>
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
            <Card>
                <CardHeader>
                    <CardTitle>Questions ({quiz.questions?.length ?? 0})</CardTitle>
                </CardHeader>
                <CardContent>
                    {(quiz.questions?.length ?? 0) === 0 ? (
                        <p className="text-muted-foreground text-center py-8">No questions yet. Add some to get started!</p>
                    ) : (
                        <div className="space-y-4">
                            {quiz.questions?.map((q, i) => (
                                <div key={q.id} className="p-4 border rounded-lg">
                                    <p className="font-medium mb-2">Q{i + 1}: {q.text}</p>
                                    <div className="grid grid-cols-2 gap-2 text-sm">
                                        {q.options.map((opt, j) => (
                                            <div key={j} className="p-2 bg-muted rounded">
                                                {String.fromCharCode(65 + j)}. {opt.text}
                                            </div>
                                        ))}
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-2">
                                        Time: {q.time_limit_sec}s • Points: {q.point_value}
                                    </p>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </main>
    );
}

export default function QuizDetailsPage() {
    return (
        <ProtectedRoute requireAdmin>
            <QuizDetailsContent />
        </ProtectedRoute>
    );
}
