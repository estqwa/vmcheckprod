'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/providers/AuthProvider';
import { Home, Trophy, User, LogIn } from 'lucide-react';
import { designTokens } from '@/lib/designTokens';

interface MobileBottomNavProps {
    active?: 'home' | 'leaderboard' | 'profile';
}

interface NavItem {
    key: 'home' | 'leaderboard' | 'profile';
    href: string;
    icon: React.ReactNode;
    authRequired?: boolean;
}

const ICON_SIZE = designTokens.iconSize.cta;

const navItems: NavItem[] = [
    { key: 'home', href: '/', icon: <Home size={ICON_SIZE} /> },
    { key: 'leaderboard', href: '/leaderboard', icon: <Trophy size={ICON_SIZE} /> },
    { key: 'profile', href: '/profile', icon: <User size={ICON_SIZE} />, authRequired: true },
];

export function MobileBottomNav({ active }: MobileBottomNavProps) {
    const tNav = useTranslations('nav');
    const { isAuthenticated } = useAuth();
    const pathname = usePathname();
    const activeRoute = active ?? detectActive(pathname);

    return (
        <nav
            aria-label="Bottom navigation"
            className="fixed bottom-4 left-4 right-4 z-50 md:hidden"
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
            <div className="mx-auto flex max-w-md justify-around gap-2 rounded-2xl border border-border/70 bg-white/95 p-2 shadow-lg backdrop-blur">
                {navItems.map((item) => {
                    if (item.authRequired && !isAuthenticated) {
                        if (item.key === 'profile') {
                            return (
                                <Link
                                    key="login"
                                    href="/login"
                                    className="flex min-h-[52px] flex-1 flex-col items-center justify-center rounded-xl px-2 py-2 text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
                                >
                                    <LogIn size={ICON_SIZE} />
                                    <span className="mt-1 text-xs font-medium">{tNav('login')}</span>
                                </Link>
                            );
                        }
                        return null;
                    }

                    const isActive = activeRoute === item.key;

                    return (
                        <Link
                            key={item.key}
                            href={item.href}
                            aria-current={isActive ? 'page' : undefined}
                            className={`flex min-h-[52px] flex-1 flex-col items-center justify-center rounded-xl px-2 py-2 transition-colors ${isActive ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'}`}
                        >
                            {item.icon}
                            <span className="mt-1 text-xs font-medium">{tNav(item.key)}</span>
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
}

function detectActive(pathname: string): 'home' | 'leaderboard' | 'profile' | undefined {
    const stripped = pathname.replace(/^\/(ru|kk)/, '') || '/';
    if (stripped === '/') return 'home';
    if (stripped.startsWith('/leaderboard')) return 'leaderboard';
    if (stripped.startsWith('/profile')) return 'profile';
    return undefined;
}

