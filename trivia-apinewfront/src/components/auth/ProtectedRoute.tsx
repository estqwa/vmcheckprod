'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/providers/AuthProvider';
import { Skeleton } from '@/components/ui/skeleton';

interface ProtectedRouteProps {
    children: React.ReactNode;
    requireAdmin?: boolean;
}

export function ProtectedRoute({ children, requireAdmin = false }: ProtectedRouteProps) {
    const router = useRouter();
    const { isAuthenticated, isAdmin, isLoading } = useAuth();

    useEffect(() => {
        if (!isLoading) {
            if (!isAuthenticated) {
                router.push('/login');
            } else if (requireAdmin && !isAdmin) {
                router.push('/');
            }
        }
    }, [isAuthenticated, isAdmin, isLoading, requireAdmin, router]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-app">
                <div className="space-y-4 w-full max-w-md p-8">
                    <Skeleton className="h-8 w-3/4" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-32 w-full" />
                </div>
            </div>
        );
    }

    if (!isAuthenticated) {
        return null;
    }

    if (requireAdmin && !isAdmin) {
        return null;
    }

    return <>{children}</>;
}
