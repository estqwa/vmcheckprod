'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/providers/AuthProvider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';

export default function LoginPage() {
    const router = useRouter();
    const { login, isLoading } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    const t = useTranslations('auth');
    const tCommon = useTranslations('common');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        try {
            await login(email, password);
            toast.success(t('loginSuccess') || 'С возвращением!');
            router.push('/');
        } catch (error: unknown) {
            const err = error as { error?: string };
            toast.error(err.error || t('loginError'));
        }
    };

    return (
        <div className="min-h-app flex flex-col">
            {/* Header */}
            <header className="border-b border-border/50 bg-white/80 backdrop-blur-sm">
                <div className="container max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
                    <Link href="/" className="flex items-center gap-2">
                        <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
                            <span className="text-white font-bold text-lg">Q</span>
                        </div>
                        <span className="font-bold text-xl text-foreground">QazaQuiz</span>
                    </Link>
                    <LanguageSwitcher />
                </div>
            </header>

            {/* Main */}
            <main className="flex-1 flex items-center justify-center px-4 py-12">
                <Card className="w-full max-w-md card-elevated border-0 rounded-2xl">
                    <CardHeader className="text-center pb-2">
                        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                            <span className="text-3xl">👋</span>
                        </div>
                        <CardTitle className="text-2xl">{t('login')}</CardTitle>
                        <CardDescription>{t('loginDescription') || 'Введите данные для входа'}</CardDescription>
                    </CardHeader>
                    <form onSubmit={handleSubmit}>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="email">{t('email')}</Label>
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
                                <Label htmlFor="password">{t('password')}</Label>
                                <Input
                                    id="password"
                                    type="password"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    className="h-12"
                                />
                            </div>
                        </CardContent>
                        <CardFooter className="flex flex-col gap-4">
                            <Button type="submit" className="w-full h-12 btn-coral text-base" disabled={isLoading}>
                                {isLoading ? tCommon('loading') : t('loginButton')}
                            </Button>
                            <p className="text-sm text-muted-foreground text-center">
                                {t('noAccount')}{' '}
                                <Link href="/register" className="text-primary hover:underline font-medium">
                                    {t('registerButton')}
                                </Link>
                            </p>
                        </CardFooter>
                    </form>
                </Card>
            </main>
        </div>
    );
}
