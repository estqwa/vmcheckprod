'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ChevronLeft } from 'lucide-react';

interface BackButtonProps {
    /** Target URL. If omitted, uses router.back() */
    href?: string;
    /** Button label. Defaults to "Назад" */
    label?: string;
    /** Variant */
    variant?: 'ghost' | 'outline';
    /** Size */
    size?: 'sm' | 'default';
}

/**
 * Unified back navigation button for admin and user pages.
 * Uses either a Link (when href is provided) or router.back().
 */
export function BackButton({ href, label = 'Назад', variant = 'ghost', size = 'sm' }: BackButtonProps) {
    const router = useRouter();

    if (href) {
        return (
            <Button asChild variant={variant} size={size}>
                <Link href={href}>
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    {label}
                </Link>
            </Button>
        );
    }

    return (
        <Button variant={variant} size={size} onClick={() => router.back()}>
            <ChevronLeft className="w-4 h-4 mr-1" />
            {label}
        </Button>
    );
}
