'use client';

import { ReactNode, useEffect } from 'react';
import { useParams, usePathname } from 'next/navigation';
import { QuizWebSocketProvider, useQuizWebSocket } from '@/providers/QuizWebSocketProvider';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';

// Inner component that uses the WebSocket context
function QuizLayoutInner({ children }: { children: ReactNode }) {
    const params = useParams();
    const pathname = usePathname();
    const { connect, disconnect, isConnected, quizId: connectedQuizId } = useQuizWebSocket();

    const quizId = Number(params.id);

    // Connect when entering quiz flow (but not on results page - it uses REST API only)
    useEffect(() => {
        const isResultsPage = pathname?.endsWith('/results');
        if (!quizId || isNaN(quizId) || isResultsPage) return;

        // Connect if not connected or connected to different quiz
        if (!isConnected || connectedQuizId !== quizId) {
            connect(quizId);
        }
    }, [quizId, isConnected, connectedQuizId, connect, pathname]);

    // Disconnect only when leaving quiz flow entirely
    useEffect(() => {
        return () => {
            // Check if we're navigating away from this quiz entirely
            // This is handled by the provider's pathname detection
        };
    }, []);

    // Handle navigation outside quiz flow
    useEffect(() => {
        const isInQuizFlow = pathname?.includes(`/quiz/${quizId}/`);

        if (!isInQuizFlow && isConnected) {
            disconnect();
        }
    }, [pathname, quizId, isConnected, disconnect]);

    return <>{children}</>;
}

// Main layout component - wraps children with the WebSocket provider
export default function QuizLayout({ children }: { children: ReactNode }) {
    return (
        <ProtectedRoute>
            <QuizWebSocketProvider>
                <QuizLayoutInner>
                    {children}
                </QuizLayoutInner>
            </QuizWebSocketProvider>
        </ProtectedRoute>
    );
}
