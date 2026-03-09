'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ChevronRight, Home, Trophy, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { useAuth } from '@/providers/AuthProvider';
import { designTokens } from '@/lib/designTokens';

type ActivePage = 'home' | 'leaderboard' | 'profile' | null;

interface PageHeaderProps {
    active?: ActivePage;
    admin?: boolean;
    rightSlot?: React.ReactNode;
    minimal?: boolean;
}

export function PageHeader({ active = null, admin = false, rightSlot, minimal = false }: PageHeaderProps) {
    const tNav = useTranslations('nav');
    const { user, isAuthenticated, logout } = useAuth();
    const iconSize = designTokens.iconSize.nav;

    const navItems: { key: ActivePage; href: string; icon: React.ReactNode; label: string }[] = [
        { key: 'home', href: '/', icon: <Home size={iconSize} />, label: tNav('home') },
        { key: 'leaderboard', href: '/leaderboard', icon: <Trophy size={iconSize} />, label: tNav('leaderboard') },
    ];

    if (isAuthenticated) {
        navItems.push({ key: 'profile', href: '/profile', icon: <User size={iconSize} />, label: tNav('profile') });
    }

    const authActions = rightSlot ? (
        rightSlot
    ) : isAuthenticated ? (
        <>
            <span className="hidden sm:inline text-sm text-muted-foreground">
                {user?.username}
            </span>
            <Button variant="outline" size="sm" onClick={() => logout()}>
                {tNav('logout')}
            </Button>
        </>
    ) : minimal ? null : (
        <>
            <Button asChild variant="ghost" size="sm" className="flex-1 md:flex-none">
                <Link href="/login" className="justify-center">
                    {tNav('login')}
                </Link>
            </Button>
            <Button asChild size="sm" className="btn-coral flex-1 md:flex-none">
                <Link href="/register" className="flex items-center justify-center gap-1.5">
                    {tNav('register')}
                    <ChevronRight size={14} />
                </Link>
            </Button>
        </>
    );

    return (
        <header className="sticky top-0 z-50 border-b border-border/50 bg-white/80 backdrop-blur-sm">
            <div className="container mx-auto max-w-6xl px-4 py-3 md:h-16 md:py-0">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-center justify-between gap-3">
                        <Link href="/" className="flex items-center gap-2">
                            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
                                <span className="text-lg font-bold text-white">Q</span>
                            </div>
                            <span className="text-lg font-bold text-foreground sm:text-xl">QazaQuiz</span>
                            {admin ? (
                                <span className="ml-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">Admin</span>
                            ) : null}
                        </Link>

                        <div className="md:hidden">
                            <LanguageSwitcher />
                        </div>
                    </div>

                    {!minimal ? (
                        <nav className="hidden items-center gap-1 md:flex" aria-label="Primary navigation">
                            {navItems.map((item) => (
                                <Button
                                    key={item.key}
                                    asChild
                                    variant="ghost"
                                    size="sm"
                                    className={active === item.key ? 'bg-primary/10 text-primary' : ''}
                                >
                                    <Link
                                        href={item.href}
                                        aria-current={active === item.key ? 'page' : undefined}
                                        className="flex items-center gap-1.5"
                                    >
                                        {item.icon}
                                        {item.label}
                                    </Link>
                                </Button>
                            ))}
                        </nav>
                    ) : null}

                    <div className={`flex items-center gap-2 ${minimal ? 'justify-end' : 'w-full justify-end md:w-auto'} ${!minimal && !isAuthenticated && !rightSlot ? 'md:justify-normal' : ''}`}>
                        <div className="hidden md:block">
                            <LanguageSwitcher />
                        </div>
                        {authActions}
                    </div>
                </div>
            </div>
        </header>
    );
}
