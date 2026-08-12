import React, { useEffect, useState } from 'react';
import { User, Shield, Zap, FileText, Star } from './icons';
import Button from './Button';
import { fetchPurchaseHistory, CreditPurchaseRecord } from '../services/billingService';

interface SettingsPanelProps {
    user: any;
    onOpenPricing: () => void;
    onOpenRedeemCode: () => void;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({ user, onOpenPricing, onOpenRedeemCode }) => {
    const [activeTab, setActiveTab] = useState<'profile' | 'subscription' | 'billing' | 'security'>('profile');
    const [purchases, setPurchases] = useState<CreditPurchaseRecord[] | null>(null);
    const [purchasesError, setPurchasesError] = useState<string | null>(null);

    useEffect(() => {
        if (activeTab !== 'billing' || purchases !== null) return;
        const token = localStorage.getItem('hrl_sso_token_v3') || localStorage.getItem('access_token');
        if (!token) {
            setPurchasesError('Zaloguj się, aby zobaczyć historię zakupów.');
            return;
        }
        fetchPurchaseHistory(token)
            .then(setPurchases)
            .catch((e) => setPurchasesError(e instanceof Error ? e.message : 'Nie udało się załadować historii.'));
    }, [activeTab, purchases]);

    const tabs = [
        { id: 'profile', label: 'Profile', icon: User },
        { id: 'subscription', label: 'Subscription', icon: Star },
        { id: 'billing', label: 'Billing & Invoices', icon: FileText },
        { id: 'security', label: 'Security & API', icon: Shield },
    ];

    return (
        <div className="max-w-5xl mx-auto animate-fade-in">
            <div className="mb-8 text-center md:text-left">
                <h1 className="text-4xl font-black text-slate-900 dark:text-white mb-2">Account Settings</h1>
                <p className="text-slate-500 font-medium">Manage your laboratory identity, subscription and billing details.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                {/* Sidebar Tabs */}
                <div className="lg:col-span-1 space-y-2">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-bold ${activeTab === tab.id
                                ? 'bg-accent-violet text-white shadow-lg shadow-accent-violet/20'
                                : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800/50'}`}
                        >
                            <tab.icon className="w-5 h-5" />
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Content Area */}
                <div className="lg:col-span-3 space-y-8">

                    {activeTab === 'profile' && (
                        <div className="bg-white/5 backdrop-blur-md rounded-[2.5rem] p-8 md:p-10 border border-white/10 space-y-8">
                            <div className="flex flex-col md:flex-row items-center gap-6">
                                <div className="w-24 h-24 rounded-3xl bg-gradient-to-tr from-accent-violet to-accent-blue flex items-center justify-center text-3xl font-black text-white shadow-xl">
                                    {user?.name?.charAt(0).toUpperCase() || 'G'}
                                </div>
                                <div className="text-center md:text-left">
                                    <h3 className="text-2xl font-black dark:text-white">{user?.name || 'Guest User'}</h3>
                                    <p className="text-slate-500 font-medium">{user?.email || 'No email associated'}</p>
                                    <button className="text-accent-violet text-sm font-bold mt-2 hover:underline">Change Studio Avatar</button>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">First Name</label>
                                    <input type="text" defaultValue={user?.name?.split(' ')[0]} className="w-full bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-white/10 p-4 rounded-2xl focus:ring-2 ring-accent-violet outline-none transition-all dark:text-white" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Last Name</label>
                                    <input type="text" defaultValue={user?.name?.split(' ')[1]} className="w-full bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-white/10 p-4 rounded-2xl focus:ring-2 ring-accent-violet outline-none transition-all dark:text-white" />
                                </div>
                                <div className="md:col-span-2 space-y-2">
                                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Studio Name / Company</label>
                                    <input type="text" placeholder="e.g. HardbanRecords Lab" className="w-full bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-white/10 p-4 rounded-2xl focus:ring-2 ring-accent-violet outline-none transition-all dark:text-white" />
                                </div>
                            </div>

                            <div className="pt-6 border-t border-slate-100 dark:border-white/5 flex justify-end">
                                <Button variant="primary" className="grad-violet px-10">Save Professional Profile</Button>
                            </div>
                        </div>
                    )}

                    {activeTab === 'subscription' && (
                        <div className="space-y-6">
                            <div className="bg-gradient-to-br from-indigo-900 via-indigo-950 to-slate-950 rounded-[2.5rem] p-10 border border-white/10 shadow-2xl relative overflow-hidden group">
                                <div className="absolute top-0 right-0 w-64 h-64 bg-accent-violet/10 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2 group-hover:bg-accent-violet/20 transition-all duration-700"></div>

                                <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center mb-12 gap-6">
                                    <div className="space-y-3">
                                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 backdrop-blur-md">
                                            <Zap className="w-3 h-3 text-accent-violet fill-accent-violet" />
                                            <span className="text-[10px] font-black text-white uppercase tracking-[0.2em]">{user?.tier || 'starter'} tier</span>
                                        </div>
                                        <h3 className="text-5xl font-black text-white">
                                            {user?.isAdmin ? 'Unlimited' : `${user?.credits ?? 0} kredytów`}
                                        </h3>
                                        <p className="text-slate-400 font-medium max-w-sm">
                                            Kredyty kupowane jednorazowo — bez subskrypcji i bez automatycznego odnawiania.
                                        </p>
                                    </div>
                                </div>

                                <div className="relative z-10 flex flex-wrap gap-4">
                                    <Button variant="primary" className="bg-white text-slate-900 hover:bg-slate-100 px-8" onClick={onOpenPricing}>Kup kredyty</Button>
                                    <Button variant="secondary" className="border-white/20 text-white hover:bg-white/10 px-8" onClick={onOpenRedeemCode}>Wykorzystaj kod</Button>
                                </div>
                            </div>

                            <div className="bg-white/5 backdrop-blur-md rounded-[2.5rem] p-10 border border-white/10">
                                <h4 className="text-xl font-black mb-8 dark:text-white tracking-tight">Możliwości silnika</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                    {[
                                        'Analiza DSP + zespół 5 modeli AI',
                                        'Przetwarzanie wsadowe (batch)',
                                        'Eksport DDEX / CWR',
                                        'Certyfikaty PDF + odcisk SHA-256',
                                    ].map((f, i) => (
                                        <div key={i} className="flex items-center gap-4 text-sm text-slate-600 dark:text-slate-400 font-bold bg-white/5 p-4 rounded-2xl border border-white/5">
                                            <div className="w-8 h-8 rounded-xl bg-accent-emerald/20 flex items-center justify-center text-accent-emerald shadow-lg shadow-accent-emerald/10">
                                                <Zap className="w-4 h-4 fill-accent-emerald" />
                                            </div>
                                            {f}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'billing' && (
                        <div className="space-y-6">
                            <div className="bg-white/5 backdrop-blur-md rounded-[2.5rem] p-8 md:p-10 border border-white/10">
                                <h4 className="text-xl font-black mb-8 dark:text-white flex items-center gap-3">
                                    <FileText className="w-7 h-7 text-accent-violet" /> Historia zakupów kredytów
                                </h4>
                                <div className="space-y-2">
                                    {purchasesError && (
                                        <p className="text-red-500 text-sm" role="alert">{purchasesError}</p>
                                    )}
                                    {!purchasesError && purchases === null && (
                                        <p className="text-slate-500 text-sm">Ładowanie…</p>
                                    )}
                                    {!purchasesError && purchases !== null && purchases.length === 0 && (
                                        <p className="text-slate-500 text-sm">Brak zakupów — kup pierwszy pakiet kredytów, żeby zobaczyć go tutaj.</p>
                                    )}
                                    {purchases?.map((p) => (
                                        <div key={p.id} className="flex flex-col sm:flex-row items-center justify-between p-5 hover:bg-white/5 rounded-2xl transition-all group border border-transparent hover:border-white/5">
                                            <div className="flex items-center gap-5 mb-4 sm:mb-0">
                                                <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-400 group-hover:bg-accent-violet group-hover:text-white flex items-center justify-center transition-all duration-300 shadow-inner">
                                                    <FileText className="w-6 h-6" />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-black dark:text-white capitalize">{p.pack_id || 'pakiet'} — {p.credits_added} kredytów</p>
                                                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                                                        {p.created_at ? new Date(p.created_at).toLocaleDateString('pl-PL', { year: 'numeric', month: 'long', day: 'numeric' }) : ''}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-8">
                                                <p className="text-lg font-black dark:text-white">
                                                    {p.amount_total != null ? `$${(p.amount_total / 100).toFixed(2)}` : '—'}
                                                </p>
                                                <span className="text-[10px] font-black uppercase text-accent-emerald bg-accent-emerald/10 px-4 py-1.5 rounded-full border border-accent-emerald/20">Opłacone</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
};

export default SettingsPanel;
