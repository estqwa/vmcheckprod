'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/providers/AuthProvider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

export default function RegisterPage() {
    const router = useRouter();
    const { register, isLoading } = useAuth();
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (password !== confirmPassword) {
            toast.error('Пароли не совпадают');
            return;
        }

        if (password.length < 6) {
            toast.error('Пароль должен быть минимум 6 символов');
            return;
        }

        try {
            await register(username, email, password);
            toast.success('Аккаунт создан! Добро пожаловать!');
            router.push('/');
        } catch (error: unknown) {
            const err = error as { error?: string };
            toast.error(err.error || 'Ошибка регистрации');
        }
    };

    return (
        <div className="min-h-screen flex flex-col">
            {/* Header */}
            <header className="border-b border-border/50 bg-white/80 backdrop-blur-sm">
                <div className="container max-w-6xl mx-auto px-4 h-16 flex items-center">
                    <Link href="/" className="flex items-center gap-2">
                        <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
                            <span className="text-white font-bold text-lg">Q</span>
                        </div>
                        <span className="font-bold text-xl text-foreground">QazaQuiz</span>
                    </Link>
                </div>
            </header>

            {/* Main */}
            <main className="flex-1 flex items-center justify-center px-4 py-12">
                <Card className="w-full max-w-md card-elevated border-0 rounded-2xl">
                    <CardHeader className="text-center pb-2">
                        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                            <span className="text-3xl">🎮</span>
                        </div>
                        <CardTitle className="text-2xl">Создать аккаунт</CardTitle>
                        <CardDescription>Присоединяйся к викторинам и выигрывай призы!</CardDescription>
                    </CardHeader>
                    <form onSubmit={handleSubmit}>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="username">Имя пользователя</Label>
                                <Input
                                    id="username"
                                    type="text"
                                    placeholder="ВашНикнейм"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    required
                                    minLength={3}
                                    maxLength={50}
                                    className="h-12"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="email">Email</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="you@example.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    className="h-12"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="password">Пароль</Label>
                                <Input
                                    id="password"
                                    type="password"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    minLength={6}
                                    className="h-12"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="confirmPassword">Подтвердите пароль</Label>
                                <Input
                                    id="confirmPassword"
                                    type="password"
                                    placeholder="••••••••"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    required
                                    className="h-12"
                                />
                            </div>
                        </CardContent>
                        <CardFooter className="flex flex-col gap-4">
                            <Button type="submit" className="w-full h-12 btn-coral text-base" disabled={isLoading}>
                                {isLoading ? 'Создаём аккаунт...' : 'Создать аккаунт'}
                            </Button>
                            <p className="text-sm text-muted-foreground text-center">
                                Уже есть аккаунт?{' '}
                                <Link href="/login" className="text-primary hover:underline font-medium">
                                    Войти
                                </Link>
                            </p>
                        </CardFooter>
                    </form>
                </Card>
            </main>
        </div>
    );
}
