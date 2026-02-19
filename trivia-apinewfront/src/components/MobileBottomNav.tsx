'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/providers/AuthProvider';
import { Home, Trophy, User, LogIn } from 'lucide-react';
import { designTokens } from '@/lib/designTokens';

interface MobileBottomNavProps {
    /** Currently active route name: 'home' | 'leaderboard' | 'profile' */
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

/**
 * Shared mobile bottom navigation bar.
 * Extracts the duplicated pattern from ~4 pages.
 * Includes safe-area-inset-bottom for iOS notch devices.
 */
export function MobileBottomNav({ active }: MobileBottomNavProps) {
    const tNav = useTranslations('nav');
    const { isAuthenticated } = useAuth();
    const pathname = usePathname();

    // Auto-detect active if not provided
    const activeRoute = active ?? detectActive(pathname);

    return (
        <div
            className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-border/50 py-2 px-4 z-50"
            style={{ paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom))' }}
        >
            <div className="flex justify-around">
                {navItems.map((item) => {
                    if (item.authRequired && !isAuthenticated) {
                        // Show login instead of profile for unauthenticated users
                        if (item.key === 'profile') {
                            return (
                                <Link
                                    key="login"
                                    href="/login"
                                    className="flex flex-col items-center text-muted-foreground"
                                >
                                    <LogIn size={ICON_SIZE} />
                                    <span className="text-xs mt-1">{tNav('login')}</span>
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
                            className={`flex flex-col items-center ${isActive ? 'text-primary' : 'text-muted-foreground'}`}
                        >
                            {item.icon}
                            <span className="text-xs mt-1">{tNav(item.key)}</span>
                        </Link>
                    );
                })}
            </div>
        </div>
    );
}

/**
 * Auto-detects active nav item from pathname.
 * Strips locale prefix before matching.
 */
function detectActive(pathname: string): 'home' | 'leaderboard' | 'profile' | undefined {
    // Strip locale prefix like /ru or /kk
    const stripped = pathname.replace(/^\/(ru|kk)/, '') || '/';
    if (stripped === '/') return 'home';
    if (stripped.startsWith('/leaderboard')) return 'leaderboard';
    if (stripped.startsWith('/profile')) return 'profile';
    return undefined;
}
