import React from 'react';
import { Home, Music, Clock, Wrench, Settings, LogOut, Info, Star, User as UserIcon, TrendingUp, Gift, ChevronLeft, ChevronRight } from './icons';
import { useAuth } from '../contexts/AuthContext';
import { UserTier } from '../types';

interface SidebarProps {
    currentView: string;
    onChangeView: (view: any) => void;
    onOpenAbout: () => void;
    isOpenMobile: boolean;
    onCloseMobile: () => void;
    onOpenPricing: () => void;
    onOpenLogin: () => void;
    userCredits: number;
    userTier: UserTier;
    showToast: (msg: string, type?: any) => void;
    isCollapsed: boolean;
    onToggleCollapse: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({
    currentView,
    onChangeView,
    onOpenAbout,
    isOpenMobile,
    onCloseMobile,
    onOpenPricing,
    onOpenLogin,
    userCredits,
    userTier,
    showToast,
    isCollapsed,
    onToggleCollapse
}) => {
    const { user, isAuthenticated, logout } = useAuth();

    const menuItems = [
        { id: 'dashboard', label: 'Dashboard', icon: Home },
        { id: 'analyze', label: 'Analyze', icon: Music },
        { id: 'history', label: 'History', icon: Clock },
        { id: 'tools', label: 'Tools', icon: Wrench },
    ];

    const handleNavigation = (id: string) => {
        onChangeView(id);
        onCloseMobile();
    };

    return (
        <>
            {/* Mobile Overlay */}
            {isOpenMobile && (
                <div
                    className="fixed inset-0 bg-black/60 z-40 lg:hidden backdrop-blur-md"
                    onClick={onCloseMobile}
                />
            )}

            {/* Sidebar Container */}
            <aside
                className={`fixed top-0 left-0 z-50 h-screen glass border-r border-white/10 transform transition-all duration-300 lg:translate-x-0 flex flex-col ${isOpenMobile ? 'translate-x-0 shadow-2xl w-72' : '-translate-x-full'
                    } ${isCollapsed ? 'lg:w-20' : 'lg:w-72'}`}
            >
                {/* Logo Section */}
                <div className={`p-4 ${isCollapsed ? 'flex justify-center' : 'p-8'}`}>
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 md:w-12 md:h-12 bg-gradient-to-br from-indigo-500 via-purple-600 to-pink-600 rounded-2xl flex items-center justify-center shadow-[0_10px_25px_-5px_rgba(99,102,241,0.5)] shrink-0">
                            <Music className="w-6 h-6 md:w-7 md:h-7 text-white" />
                        </div>
                        {!isCollapsed && (
                            <div className="animate-fade-in">
                                <h1 className="font-black text-xl text-slate-900 dark:text-white leading-none tracking-tighter whitespace-nowrap">
                                    STUDIO
                                </h1>
                                <span className="text-[10px] font-black text-accent-violet uppercase tracking-[0.3em] whitespace-nowrap">MASTER ENGINE</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Navigation */}
                <nav className="flex-grow p-4 space-y-2 overflow-y-auto custom-scrollbar overflow-x-hidden">
                    {menuItems.map(item => (
                        <button
                            key={item.id}
                            onClick={() => handleNavigation(item.id)}
                            title={isCollapsed ? item.label : ''}
                            className={`w-full flex items-center ${isCollapsed ? 'justify-center px-0' : 'justify-between px-5'} py-4 rounded-2xl transition-all duration-300 group ${currentView === item.id
                                ? 'bg-gradient-to-r from-accent-violet to-accent-blue text-white shadow-xl shadow-accent-violet/25'
                                : 'text-slate-500 dark:text-slate-400 hover:bg-white/5 hover:text-slate-900 dark:hover:text-white'
                                }`}
                        >
                            <div className={`flex items-center gap-4 ${isCollapsed ? 'justify-center w-full' : ''}`}>
                                <item.icon className={`w-5 h-5 transition-transform duration-300 ${isCollapsed ? '' : 'group-hover:scale-110'} ${currentView === item.id ? 'text-white' : 'text-slate-400 group-hover:text-accent-violet'}`} />
                                {!isCollapsed && <span className="font-bold tracking-tight">{item.label}</span>}
                            </div>
                            {!isCollapsed && currentView === item.id && <div className="w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_8px_white]"></div>}
                        </button>
                    ))}

                    <div className="pt-8 px-4 opacity-50">
                        <div className="h-px bg-gradient-to-r from-transparent via-slate-500 to-transparent"></div>
                    </div>

                    <div className="pt-4 px-2 space-y-1">
                        <button
                            onClick={onOpenAbout}
                            title="Documentation"
                            className={`w-full flex items-center ${isCollapsed ? 'justify-center' : 'gap-4 px-4'} py-3 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-white/5 transition-all text-sm font-bold group`}
                        >
                            <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center group-hover:bg-accent-violet/20 transition-all">
                                <Info className="w-4 h-4 group-hover:text-accent-violet transition-colors" />
                            </div>
                            {!isCollapsed && <span>Documentation</span>}
                        </button>
                    </div>
                </nav>

                {/* Collapse Toggle */}
                <div className="hidden lg:flex justify-center py-2 relative">
                    <button
                        onClick={onToggleCollapse}
                        className="p-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-accent-violet border border-slate-200 dark:border-slate-700 shadow-sm transition-all hover:scale-110"
                    >
                        {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                    </button>
                </div>

                {/* User Profile Section */}
                <div className={`p-4 mt-auto ${isCollapsed ? 'px-2' : 'p-6'}`}>
                    {isAuthenticated && user ? (
                        <div className={`bg-slate-950/40 rounded-[2rem] border border-white/5 ${isCollapsed ? 'p-2 space-y-2' : 'p-5 space-y-4'}`}>
                            {/* Profile Header */}
                            <div className={`flex items-center ${isCollapsed ? 'justify-center flex-col gap-2' : 'gap-4'}`}>
                                <div className={`rounded-2xl flex items-center justify-center text-white font-black shadow-2xl ${isCollapsed ? 'w-10 h-10' : 'w-14 h-14'
                                    } ${userTier !== 'starter' ? 'bg-gradient-to-tr from-accent-violet via-purple-600 to-accent-blue' : 'bg-slate-800 border border-white/10'}`}>
                                    {userTier !== 'starter' ? <Star className={isCollapsed ? "w-5 h-5" : "w-6 h-6"} /> : (user.name ? user.name.charAt(0).toUpperCase() : 'U')}
                                </div>
                                {!isCollapsed && (
                                    <div className="flex-grow min-w-0">
                                        <p className="text-sm font-black text-white truncate tracking-tight">{user.name}</p>
                                        <div className="flex items-center gap-1.5">
                                            <div className={`w-1.5 h-1.5 rounded-full ${userTier !== 'starter' ? 'bg-accent-violet animate-pulse' : 'bg-slate-500'}`}></div>
                                            <p className={`text-[9px] uppercase tracking-widest font-black ${userTier !== 'starter' ? 'text-accent-violet' : 'text-slate-500'}`}>
                                                {userTier} Level
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Additional Actions */}
                            <div className={`grid ${isCollapsed ? 'grid-cols-1 gap-1' : 'grid-cols-2 gap-2'}`}>
                                <button
                                    onClick={() => handleNavigation('settings')}
                                    title="Setup"
                                    className={`flex flex-col items-center justify-center rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all group ${isCollapsed ? 'p-2' : 'p-3'}`}
                                >
                                    <Settings className="w-4 h-4 text-slate-500 group-hover:text-accent-violet transition-colors mb-1" />
                                    {!isCollapsed && <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Setup</span>}
                                </button>
                                <button
                                    onClick={() => handleNavigation('usage')}
                                    title="Usage"
                                    className={`flex flex-col items-center justify-center rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all group ${isCollapsed ? 'p-2' : 'p-3'}`}
                                >
                                    <TrendingUp className="w-4 h-4 text-slate-500 group-hover:text-accent-blue transition-colors mb-1" />
                                    {!isCollapsed && <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Usage</span>}
                                </button>
                            </div>

                            <button
                                onClick={logout}
                                title="Logout"
                                className={`w-full flex items-center justify-center gap-2 text-[9px] font-black text-slate-600 hover:text-red-400 transition-all uppercase tracking-[0.2em] ${isCollapsed ? 'pt-1' : 'pt-2'}`}
                            >
                                <LogOut className="w-3 h-3" /> {!isCollapsed && "Terminate Session"}
                            </button>
                        </div>
                    ) : (
                        <button onClick={onOpenLogin} className="w-full grad-violet text-white py-4 rounded-2xl font-black text-sm shadow-xl shadow-accent-violet/30 active:scale-95 transition-all flex items-center justify-center">
                            {isCollapsed ? <UserIcon className="w-5 h-5" /> : "ACCESS STUDIO"}
                        </button>
                    )}
                </div>
            </aside>
        </>
    );
};

export default Sidebar;
