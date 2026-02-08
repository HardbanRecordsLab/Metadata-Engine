import React, { useEffect, useState } from 'react';
import { TrendingUp, Database, Zap, Clock, Globe, Shield } from './icons';
import Button from './Button';
import { getFullUrl } from '../apiConfig';

interface UsagePanelProps {
    user: any;
}

const UsagePanel: React.FC<UsagePanelProps> = ({ user }) => {
    const [stats, setStats] = useState({
        totalAnalyses: 0,
        storageUsed: '0 GB',
        efficiency: '99.9%',
        limit: 100
    });
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const token = localStorage.getItem('access_token');
                if (!token) return;

                const res = await fetch(getFullUrl('/history/'), {
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (res.ok) {
                    const history = await res.json();
                    setStats(prev => ({
                        ...prev,
                        totalAnalyses: history.length,
                        // Mock storage calculation: roughly 10MB per analysis as an estimate
                        storageUsed: `${(history.length * 0.01).toFixed(2)} GB`
                    }));
                }
            } catch (err) {
                console.error("Failed to fetch usage stats", err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchStats();
    }, [user]);

    return (
        <div className="max-w-6xl mx-auto animate-fade-in">
            <div className="mb-10">
                <h1 className="text-4xl font-black text-slate-900 dark:text-white mb-2">Resource Insights</h1>
                <p className="text-slate-500">Real-time monitoring of your laboratory throughput and storage.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                <div className="panel-card flex items-center gap-6">
                    <div className="w-16 h-16 rounded-2xl bg-accent-violet/10 text-accent-violet flex items-center justify-center">
                        <Database className="w-8 h-8" />
                    </div>
                    <div>
                        <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Storage Used</p>
                        <p className="text-3xl font-black dark:text-white">
                            {isLoading ? '...' : stats.storageUsed}
                            <span className="text-sm font-normal text-slate-500"> / 10 GB</span>
                        </p>
                    </div>
                </div>
                <div className="panel-card flex items-center gap-6">
                    <div className="w-16 h-16 rounded-2xl bg-accent-blue/10 text-accent-blue flex items-center justify-center">
                        <TrendingUp className="w-8 h-8" />
                    </div>
                    <div>
                        <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Credits Used</p>
                        <p className="text-3xl font-black dark:text-white">
                            {isLoading ? '...' : stats.totalAnalyses}
                            <span className="text-sm font-normal text-slate-500"> / {stats.limit}</span>
                        </p>
                    </div>
                </div>
                <div className="panel-card flex items-center gap-6">
                    <div className="w-16 h-16 rounded-2xl bg-accent-emerald/10 text-accent-emerald flex items-center justify-center">
                        <Zap className="w-8 h-8" />
                    </div>
                    <div>
                        <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Efficiency</p>
                        <p className="text-3xl font-black dark:text-white">{stats.efficiency}</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="panel-card">
                    <h3 className="text-xl font-bold mb-6 dark:text-white">Activity Timeline</h3>
                    <div className="relative h-64 flex items-end gap-3 px-4">
                        {[40, 65, 30, 85, 45, 90, 60, 100, 75, 40, 55, 80].map((h, i) => (
                            <div key={i} className="group relative flex-1">
                                <div
                                    className="w-full bg-accent-violet/20 group-hover:bg-accent-violet/50 rounded-t-lg transition-all duration-300"
                                    style={{ height: `${h}%` }}
                                ></div>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="panel-card">
                    <h3 className="text-xl font-bold mb-6 dark:text-white">System Status</h3>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                            <div className="flex items-center gap-3">
                                <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                                <span className="font-medium dark:text-slate-300">API Gateway</span>
                            </div>
                            <span className="text-emerald-500 font-bold">Operational</span>
                        </div>
                        <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                            <div className="flex items-center gap-3">
                                <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                                <span className="font-medium dark:text-slate-300">Database Cluster</span>
                            </div>
                            <span className="text-emerald-500 font-bold">Operational</span>
                        </div>
                        <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                            <div className="flex items-center gap-3">
                                <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                                <span className="font-medium dark:text-slate-300">AI Model Ensemble</span>
                            </div>
                            <span className="text-emerald-500 font-bold">Operational</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default UsagePanel;
