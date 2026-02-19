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
}

export function PageHeader({ active = null, admin = false, rightSlot }: PageHeaderProps) {
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

    return (
        <header className="border-b border-border/50 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
            <div className="container max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
                <Link href="/" className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
                        <span className="text-white font-bold text-lg">Q</span>
                    </div>
                    <span className="font-bold text-xl text-foreground">QazaQuiz</span>
                    {admin && (
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary ml-1">Admin</span>
                    )}
                </Link>

                <nav className="hidden md:flex items-center gap-1">
                    {navItems.map((item) => (
                        <Button
                            key={item.key}
                            asChild
                            variant="ghost"
                            size="sm"
                            className={active === item.key ? 'text-primary bg-primary/10' : ''}
                        >
                            <Link href={item.href} className="flex items-center gap-1.5">
                                {item.icon}
                                {item.label}
                            </Link>
                        </Button>
                    ))}
                </nav>

                <div className="flex items-center gap-2">
                    <LanguageSwitcher />

                    {rightSlot ? rightSlot : (
                        isAuthenticated ? (
                            <>
                                <span className="hidden sm:inline text-sm text-muted-foreground">
                                    {user?.username}
                                </span>
                                <Button variant="outline" size="sm" onClick={() => logout()}>
                                    {tNav('logout')}
                                </Button>
                            </>
                        ) : (
                            <>
                                <Button asChild variant="ghost" size="sm">
                                    <Link href="/login">{tNav('login')}</Link>
                                </Button>
                                <Button asChild size="sm" className="btn-coral">
                                    <Link href="/register" className="flex items-center gap-1.5">
                                        {tNav('register')}
                                        <ChevronRight size={14} />
                                    </Link>
                                </Button>
                            </>
                        )
                    )}
                </div>
            </div>
        </header>
    );
}
