import React, { useEffect, useState } from 'react';
import { TrendingUp, Database, Zap, Clock, Globe, Shield } from './icons';
import { supabase } from '../lib/supabaseClient';
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
                const { data: { session } } = await supabase.auth.getSession();
                if (!session) return;

                const token = session.access_token;
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
                                <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[8px] font-bold text-slate-400 opacity-0 group-hover:opacity-100 uppercase">
                                    Day {i + 1}
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="flex justify-between items-center mt-10 pt-6 border-t border-slate-100 dark:border-slate-800">
                        <span className="text-xs font-bold text-slate-500">LAST 12 DAYS ANALYSIS LOAD</span>
                        <div className="flex gap-4">
                            <span className="flex items-center gap-2 text-[10px] font-bold text-slate-400">
                                <div className="w-2 h-2 rounded-full bg-accent-violet"></div> VOLUME
                            </span>
                        </div>
                    </div>
                </div>

                <div className="panel-card space-y-6">
                    <h3 className="text-xl font-bold mb-2 dark:text-white">Services Distribution</h3>

                    {[
                        { label: 'AI Tagging Engine', value: 75, color: 'bg-accent-violet' },
                        { label: 'Copyright Registry', value: 15, color: 'bg-accent-blue' },
                        { label: 'Stem Separation', value: 10, color: 'bg-accent-emerald' },
                    ].map((s, i) => (
                        <div key={i} className="space-y-2">
                            <div className="flex justify-between text-sm font-bold">
                                <span className="dark:text-slate-300">{s.label}</span>
                                <span className="text-slate-500">{s.value}%</span>
                            </div>
                            <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                <div className={`${s.color} h-full transition-all duration-1000`} style={{ width: `${s.value}%` }}></div>
                            </div>
                        </div>
                    ))}

                    <div className="mt-8 p-6 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Clock className="w-5 h-5 text-slate-400" />
                            <div>
                                <p className="text-xs font-bold dark:text-white">Next Reset</p>
                                <p className="text-[10px] text-slate-500">In 12 days (Aug 1st)</p>
                            </div>
                        </div>
                        <Button variant="outline" size="sm">Manage Quotas</Button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default UsagePanel;
