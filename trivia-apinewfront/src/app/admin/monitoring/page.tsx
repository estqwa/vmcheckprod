'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { Button } from '@/components/ui/button';
import { BackButton } from '@/components/BackButton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { api } from '@/lib/api/client';

interface Metrics {
    total_connections: number;
    active_connections: number;
    messages_sent: number;
    messages_received: number;
    connection_errors: number;
    inactive_clients_removed: number;
    uptime_seconds: number;
    start_time: string;
    last_cleanup: string;
    generated_at: string;
}

interface DetailedMetrics extends Metrics {
    shard_count: number;
    avg_connections_per_shard: number;
    hot_shards: number[];
    shard_metrics: ShardMetric[];
    shard_distribution: Record<number, number>;
}

interface ShardMetric {
    shard_id: number;
    active_connections: number;
    messages_sent: number;
    load_percentage: number;
    max_clients: number;
}

interface HealthStatus {
    status: 'healthy' | 'unavailable';
    active_connections: number;
    timestamp: string;
}

interface Alert {
    type: string;
    severity: 'info' | 'warning' | 'critical';
    message: string;
    details: unknown;
}

interface AlertsResponse {
    status: 'healthy' | 'degraded' | 'critical';
    alerts: Alert[];
    alerts_count: number;
    hub_type: string;
    recommendations?: string[];
}

function MonitoringDashboard() {
    const [metrics, setMetrics] = useState<DetailedMetrics | null>(null);
    const [health, setHealth] = useState<HealthStatus | null>(null);
    const [alerts, setAlerts] = useState<AlertsResponse | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

    const fetchAll = useCallback(async () => {
        try {
            const [metricsData, healthData, alertsData] = await Promise.all([
                api.get<DetailedMetrics>('/api/admin/ws/metrics/detailed'),
                api.get<HealthStatus>('/api/admin/ws/health'),
                api.get<AlertsResponse>('/api/admin/ws/alerts'),
            ]);
            setMetrics(metricsData);
            setHealth(healthData);
            setAlerts(alertsData);
            setLastUpdate(new Date());
        } catch (error) {
            console.error('Failed to fetch metrics:', error);
            toast.error('Не удалось загрузить метрики');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchAll();
        // Auto-refresh every 30 seconds
        const interval = setInterval(fetchAll, 30000);
        return () => clearInterval(interval);
    }, [fetchAll]);

    const formatUptime = (seconds: number) => {
        const days = Math.floor(seconds / 86400);
        const hours = Math.floor((seconds % 86400) / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        if (days > 0) return `${days}д ${hours}ч`;
        if (hours > 0) return `${hours}ч ${mins}м`;
        return `${mins}м`;
    };

    const getStatusColor = (status?: string) => {
        switch (status) {
            case 'healthy': return 'bg-green-100 text-green-700';
            case 'degraded': return 'bg-yellow-100 text-yellow-700';
            case 'critical': return 'bg-red-100 text-red-700';
            default: return 'bg-gray-100 text-gray-700';
        }
    };

    const getSeverityColor = (severity: string) => {
        switch (severity) {
            case 'critical': return 'bg-red-100 text-red-700';
            case 'warning': return 'bg-yellow-100 text-yellow-700';
            default: return 'bg-blue-100 text-blue-700';
        }
    };

    return (
        <div className="min-h-app">
            {/* Header */}
            <header className="border-b border-border/50 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
                <div className="container max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
                    <Link href="/" className="flex items-center gap-2">
                        <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
                            <span className="text-white font-bold text-lg">Q</span>
                        </div>
                        <span className="font-bold text-xl text-foreground">QazaQuiz</span>
                        <Badge className="bg-primary/10 text-primary border-0 ml-2">Админ</Badge>
                    </Link>
                    <div className="flex items-center gap-2">
                        {lastUpdate && (
                            <span className="text-sm text-muted-foreground">
                                Обновлено: {lastUpdate.toLocaleTimeString('ru-RU')}
                            </span>
                        )}
                        <Button variant="outline" size="sm" onClick={fetchAll} disabled={isLoading}>
                             Обновить
                        </Button>
                        <BackButton href="/admin" label="Назад" />
                    </div>
                </div>
            </header>

            <main className="container max-w-5xl mx-auto px-4 py-8">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold"> Мониторинг WebSocket</h1>
                    <p className="text-muted-foreground">Состояние сервера и метрики в реальном времени</p>
                </div>

                {isLoading ? (
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {[...Array(4)].map((_, i) => (
                                <Skeleton key={i} className="h-24 rounded-xl" />
                            ))}
                        </div>
                        <Skeleton className="h-48 rounded-xl" />
                    </div>
                ) : (
                    <>
                        {/* Status + Basic Stats */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                            <Card className="card-elevated border-0 rounded-xl">
                                <CardContent className="pt-6 text-center">
                                    <Badge className={`${getStatusColor(health?.status)} border-0 mb-2`}>
                                        {health?.status === 'healthy' ? ' Healthy' : ' Unavailable'}
                                    </Badge>
                                    <p className="text-sm text-muted-foreground">Статус</p>
                                </CardContent>
                            </Card>
                            <Card className="card-elevated border-0 rounded-xl">
                                <CardContent className="pt-6 text-center">
                                    <p className="text-3xl font-bold text-blue-600">
                                        {metrics?.active_connections ?? 0}
                                    </p>
                                    <p className="text-sm text-muted-foreground">Подключений</p>
                                </CardContent>
                            </Card>
                            <Card className="card-elevated border-0 rounded-xl">
                                <CardContent className="pt-6 text-center">
                                    <p className="text-3xl font-bold text-green-600">
                                        {metrics?.shard_count ?? 0}
                                    </p>
                                    <p className="text-sm text-muted-foreground">Шардов</p>
                                </CardContent>
                            </Card>
                            <Card className="card-elevated border-0 rounded-xl">
                                <CardContent className="pt-6 text-center">
                                    <p className="text-3xl font-bold">
                                        {formatUptime(metrics?.uptime_seconds ?? 0)}
                                    </p>
                                    <p className="text-sm text-muted-foreground">Uptime</p>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Alerts */}
                        {alerts && alerts.alerts_count > 0 && (
                            <Card className="card-elevated border-0 rounded-2xl mb-8 border-l-4 border-l-yellow-500">
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <span className="text-xl"></span>
                                        Алерты ({alerts.alerts_count})
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-3">
                                        {alerts.alerts.map((alert, i) => (
                                            <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-secondary/30">
                                                <Badge className={`${getSeverityColor(alert.severity)} border-0`}>
                                                    {alert.severity}
                                                </Badge>
                                                <div>
                                                    <p className="font-medium">{alert.message}</p>
                                                    <p className="text-sm text-muted-foreground">{alert.type}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    {alerts.recommendations && alerts.recommendations.length > 0 && (
                                        <div className="mt-4 p-3 rounded-lg bg-blue-50">
                                            <p className="font-medium text-blue-700 mb-2"> Рекомендации:</p>
                                            <ul className="list-disc list-inside text-sm text-blue-600">
                                                {alerts.recommendations.map((rec, i) => (
                                                    <li key={i}>{rec}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        )}

                        {/* Detailed Metrics */}
                        <div className="grid md:grid-cols-2 gap-6 mb-8">
                            {/* Messages */}
                            <Card className="card-elevated border-0 rounded-2xl">
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <span className="text-xl"></span>
                                        Сообщения
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-3">
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Отправлено</span>
                                            <span className="font-mono font-medium">{metrics?.messages_sent?.toLocaleString()}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Получено</span>
                                            <span className="font-mono font-medium">{metrics?.messages_received?.toLocaleString()}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Ошибок</span>
                                            <span className={`font-mono font-medium ${(metrics?.connection_errors ?? 0) > 0 ? 'text-red-600' : ''}`}>
                                                {metrics?.connection_errors ?? 0}
                                            </span>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Connections */}
                            <Card className="card-elevated border-0 rounded-2xl">
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <span className="text-xl"></span>
                                        Подключения
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-3">
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Всего за всё время</span>
                                            <span className="font-mono font-medium">{metrics?.total_connections?.toLocaleString()}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Активных</span>
                                            <span className="font-mono font-medium text-blue-600">{metrics?.active_connections}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Удалено неактивных</span>
                                            <span className="font-mono font-medium">{metrics?.inactive_clients_removed ?? 0}</span>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Shards */}
                        {metrics?.shard_metrics && metrics.shard_metrics.length > 0 && (
                            <Card className="card-elevated border-0 rounded-2xl">
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <span className="text-xl"></span>
                                        Шарды ({metrics.shard_count})
                                        {metrics.hot_shards && metrics.hot_shards.length > 0 && (
                                            <Badge className="bg-red-100 text-red-700 border-0">
                                                {metrics.hot_shards.length} горячих
                                            </Badge>
                                        )}
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                        {metrics.shard_metrics.map((shard) => {
                                            const isHot = metrics.hot_shards?.includes(shard.shard_id);
                                            return (
                                                <div
                                                    key={shard.shard_id}
                                                    className={`p-3 rounded-xl ${isHot ? 'bg-red-50 border border-red-200' : 'bg-secondary/30'}`}
                                                >
                                                    <div className="flex items-center justify-between mb-2">
                                                        <span className="font-medium">Шард {shard.shard_id}</span>
                                                        {isHot && <Badge className="bg-red-100 text-red-700 border-0 text-xs">HOT</Badge>}
                                                    </div>
                                                    <div className="text-sm space-y-1">
                                                        <div className="flex justify-between">
                                                            <span className="text-muted-foreground">Клиенты</span>
                                                            <span>{shard.active_connections}/{shard.max_clients}</span>
                                                        </div>
                                                        <div className="flex justify-between">
                                                            <span className="text-muted-foreground">Загрузка</span>
                                                            <span className={shard.load_percentage > 75 ? 'text-red-600' : ''}>
                                                                {shard.load_percentage.toFixed(1)}%
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {/* API Links */}
                        <Card className="card-elevated border-0 rounded-2xl mt-8">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <span className="text-xl"></span>
                                    API Endpoints
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="grid md:grid-cols-2 gap-3 text-sm">
                                    <code className="p-2 bg-secondary/50 rounded">GET /api/admin/ws/metrics</code>
                                    <code className="p-2 bg-secondary/50 rounded">GET /api/admin/ws/metrics/detailed</code>
                                    <code className="p-2 bg-secondary/50 rounded">GET /api/admin/ws/metrics/prometheus</code>
                                    <code className="p-2 bg-secondary/50 rounded">GET /api/admin/ws/health</code>
                                    <code className="p-2 bg-secondary/50 rounded">GET /api/admin/ws/alerts</code>
                                </div>
                            </CardContent>
                        </Card>
                    </>
                )}
            </main>
        </div>
    );
}

export default function MonitoringPage() {
    return (
        <ProtectedRoute requireAdmin>
            <MonitoringDashboard />
        </ProtectedRoute>
    );
}
