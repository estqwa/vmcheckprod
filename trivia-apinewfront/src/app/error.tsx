'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        // Log the error to an error reporting service
        console.error('Error boundary caught:', error);
    }, [error]);

    return (
        <main className="flex items-center justify-center min-h-app px-4">
            <Card className="w-full max-w-md text-center">
                <CardHeader>
                    <CardTitle className="text-2xl text-destructive">
                        Something went wrong!
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <p className="text-muted-foreground">
                        {error.message || 'An unexpected error occurred'}
                    </p>
                    {error.digest && (
                        <p className="text-xs text-muted-foreground">
                            Error ID: {error.digest}
                        </p>
                    )}
                    <div className="flex justify-center gap-4 pt-4">
                        <Button onClick={() => reset()}>
                            Try again
                        </Button>
                        <Button variant="outline" onClick={() => window.location.href = '/'}>
                            Go Home
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </main>
    );
}
