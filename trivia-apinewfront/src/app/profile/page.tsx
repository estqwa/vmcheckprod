'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/providers/AuthProvider';
import { getSessions, revokeSession, logoutAll, Session } from '@/lib/api';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

function ProfileContent() {
    const router = useRouter();
    const { user, logout, isAdmin } = useAuth();
    const [sessions, setSessions] = useState<Session[]>([]);
    const [isLoadingSessions, setIsLoadingSessions] = useState(true);

    useEffect(() => {
        const fetchSessions = async () => {
            try {
                const data = await getSessions();
                setSessions(data.sessions || []);
            } catch (error) {
                console.error('Failed to fetch sessions:', error);
            } finally {
                setIsLoadingSessions(false);
            }
        };

        fetchSessions();
    }, []);

    const handleLogout = async () => {
        try {
            await logout();
            toast.success('Logged out successfully');
            router.push('/');
        } catch {
            toast.error('Failed to logout');
        }
    };

    const handleLogoutAll = async () => {
        try {
            await logoutAll();
            toast.success('Logged out from all devices');
            router.push('/login');
        } catch {
            toast.error('Failed to logout from all devices');
        }
    };

    const handleRevokeSession = async (sessionId: number) => {
        try {
            await revokeSession(sessionId);
            setSessions(sessions.filter(s => s.id !== sessionId));
            toast.success('Session revoked');
        } catch {
            toast.error('Failed to revoke session');
        }
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleString();
    };

    if (!user) return null;

    return (
        <main className="container max-w-4xl mx-auto px-4 py-12">
            <h1 className="text-3xl font-bold mb-8">Profile</h1>

            {/* User Info Card */}
            <Card className="mb-8">
                <CardHeader>
                    <div className="flex items-center gap-4">
                        <Avatar className="h-16 w-16">
                            <AvatarImage src={user.profile_picture} />
                            <AvatarFallback className="text-lg">
                                {user.username.substring(0, 2).toUpperCase()}
                            </AvatarFallback>
                        </Avatar>
                        <div>
                            <CardTitle className="flex items-center gap-2">
                                {user.username}
                                {isAdmin && <Badge variant="secondary">Admin</Badge>}
                            </CardTitle>
                            <CardDescription>{user.email}</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                        <div>
                            <p className="text-2xl font-bold">{user.games_played}</p>
                            <p className="text-muted-foreground text-sm">Games Played</p>
                        </div>
                        <div>
                            <p className="text-2xl font-bold">{user.wins_count}</p>
                            <p className="text-muted-foreground text-sm">Wins</p>
                        </div>
                        <div>
                            <p className="text-2xl font-bold">{user.total_score}</p>
                            <p className="text-muted-foreground text-sm">Total Score</p>
                        </div>
                        <div>
                            <p className="text-2xl font-bold">${user.total_prize_won}</p>
                            <p className="text-muted-foreground text-sm">Prize Won</p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Sessions Card */}
            <Card className="mb-8">
                <CardHeader>
                    <CardTitle>Active Sessions</CardTitle>
                    <CardDescription>Manage your active login sessions</CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoadingSessions ? (
                        <div className="space-y-3">
                            <Skeleton className="h-16 w-full" />
                            <Skeleton className="h-16 w-full" />
                        </div>
                    ) : sessions.length === 0 ? (
                        <p className="text-muted-foreground">No active sessions found</p>
                    ) : (
                        <div className="space-y-3">
                            {sessions.map((session) => (
                                <div key={session.id} className="flex items-center justify-between p-3 rounded-lg border">
                                    <div>
                                        <p className="font-medium text-sm">{session.device_id || 'Unknown Device'}</p>
                                        <p className="text-xs text-muted-foreground">
                                            {session.ip_address} • Created: {formatDate(session.created_at)}
                                        </p>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleRevokeSession(session.id)}
                                    >
                                        Revoke
                                    </Button>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Actions Card */}
            <Card>
                <CardHeader>
                    <CardTitle>Account Actions</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-4">
                    {isAdmin && (
                        <Button variant="outline" onClick={() => router.push('/admin')}>
                            Admin Panel
                        </Button>
                    )}
                    <Button variant="outline" onClick={handleLogout}>
                        Logout
                    </Button>
                    <Button variant="destructive" onClick={handleLogoutAll}>
                        Logout All Devices
                    </Button>
                </CardContent>
            </Card>
        </main>
    );
}

export default function ProfilePage() {
    return (
        <ProtectedRoute>
            <ProfileContent />
        </ProtectedRoute>
    );
}
