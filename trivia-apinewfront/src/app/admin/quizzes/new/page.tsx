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
import { toast } from 'sonner';

function CreateQuizForm() {
    const router = useRouter();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [scheduledTime, setScheduledTime] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!title.trim()) {
            toast.error('Title is required');
            return;
        }

        if (!scheduledTime) {
            toast.error('Scheduled time is required');
            return;
        }

        // Validate scheduled time is in the future
        if (new Date(scheduledTime) <= new Date()) {
            toast.error('Scheduled time must be in the future');
            return;
        }

        setIsSubmitting(true);
        try {
            const quiz = await createQuiz({
                title: title.trim(),
                description: description.trim() || undefined,
                scheduled_time: new Date(scheduledTime).toISOString(),
            });

            toast.success('Quiz created successfully!');
            router.push(`/admin/quizzes/${quiz.id}`);
        } catch (error: unknown) {
            const err = error as { error?: string };
            toast.error(err.error || 'Failed to create quiz');
        } finally {
            setIsSubmitting(false);
        }
    };

    // Default to 1 hour from now
    const getDefaultDateTime = () => {
        const date = new Date();
        date.setHours(date.getHours() + 1);
        return date.toISOString().slice(0, 16);
    };

    return (
        <main className="container max-w-2xl mx-auto px-4 py-12">
            <div className="flex items-center justify-between mb-8">
                <h1 className="text-3xl font-bold">Create Quiz</h1>
                <Link href="/admin">
                    <Button variant="ghost">← Back</Button>
                </Link>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Quiz Details</CardTitle>
                    <CardDescription>Create a new trivia quiz</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-2">
                            <Label htmlFor="title">Title *</Label>
                            <Input
                                id="title"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="Evening Trivia Challenge"
                                required
                                minLength={3}
                                maxLength={100}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="description">Description</Label>
                            <Input
                                id="description"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Test your knowledge and win prizes!"
                                maxLength={500}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="scheduledTime">Scheduled Time *</Label>
                            <Input
                                id="scheduledTime"
                                type="datetime-local"
                                value={scheduledTime || getDefaultDateTime()}
                                onChange={(e) => setScheduledTime(e.target.value)}
                                required
                            />
                            <p className="text-xs text-muted-foreground">
                                Quiz will start automatically at this time
                            </p>
                        </div>

                        <div className="flex gap-4 pt-4">
                            <Button type="submit" disabled={isSubmitting} className="flex-1">
                                {isSubmitting ? 'Creating...' : 'Create Quiz'}
                            </Button>
                            <Link href="/admin" className="flex-1">
                                <Button type="button" variant="outline" className="w-full">
                                    Cancel
                                </Button>
                            </Link>
                        </div>
                    </form>
                </CardContent>
            </Card>

            <p className="text-center text-muted-foreground text-sm mt-6">
                After creating the quiz, you&apos;ll be able to add questions.
            </p>
        </main>
    );
}

export default function CreateQuizPage() {
    return (
        <ProtectedRoute requireAdmin>
            <CreateQuizForm />
        </ProtectedRoute>
    );
}
