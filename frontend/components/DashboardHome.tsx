
import React from 'react';
import { Music, Shield, ArrowLeft, Plus, Fingerprint, Star, Users, Zap, LayoutGrid, Gift, Globe } from './icons';
import { UserProfile } from '../types';
import Button from './Button'; // Import Button component

interface DashboardHomeProps {
  onNavigate: (view: string) => void;
  onCreateNew: () => void;
  userProfile: UserProfile;
  onOpenPricing: () => void;
  onOpenRedeemCode: () => void; // New prop for opening redeem code modal
}

const DashboardHome: React.FC<DashboardHomeProps> = ({ onNavigate, onCreateNew, userProfile, onOpenPricing, onOpenRedeemCode }) => {
  const isPaid = userProfile.tier !== 'starter';

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-20 animate-fade-in">

      {/* 1. HERO SECTION - Premium Design */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 shadow-[0_20px_60px_-15px_rgba(79,70,229,0.5)] p-1">
        <div className="relative overflow-hidden rounded-[22px] bg-[#0a0b14] p-8 md:p-12">
          {/* Animated background elements */}
          <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500/20 rounded-full blur-[100px] animate-pulse"></div>
            <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-purple-500/20 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: '1s' }}></div>
            <div className="absolute top-1/2 left-1/2 w-72 h-72 bg-pink-500/20 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: '2s' }}></div>
          </div>

          <div className="absolute right-0 top-0 w-full h-full opacity-40 pointer-events-none overflow-hidden">
            <div className="w-full h-full bg-[radial-gradient(circle_at_top_right,_rgba(129,140,248,0.45),_transparent_55%),_radial-gradient(circle_at_bottom_left,_rgba(236,72,153,0.5),_transparent_55%)] blur-[2px] scale-110" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#0a0b14] via-[#0a0b14]/80 to-transparent"></div>
          </div>

          <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
            <div className="space-y-4 flex-1">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-500/20 border border-indigo-500/30 backdrop-blur-sm">
                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
                <span className="text-xs font-bold text-indigo-300 uppercase tracking-wider">Studio Active</span>
              </div>

              <h2 className="text-5xl md:text-6xl font-black text-white tracking-tight">
                Welcome Back,
                <br />
                <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 text-transparent bg-clip-text">
                  {userProfile.name}
                </span>
              </h2>

              <p className="text-slate-300 text-lg font-medium max-w-xl leading-relaxed">
                Your creative studio is powered up and ready to transform your music.
                <span className="block mt-2">
                  Current plan: <button onClick={onOpenPricing} className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-bold text-sm hover:scale-105 transition-transform uppercase">
                    {userProfile.tier} {isPaid && '✨'}
                  </button>
                  {userProfile.tier === 'starter' && userProfile.credits > 0 && (
                    <span className="ml-2 text-xs text-yellow-300 font-bold">(Credits: {userProfile.credits})</span>
                  )}
                </span>
              </p>
            </div>

            <div className="relative z-10 flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
              {!isPaid && (
                <button
                  onClick={onOpenPricing}
                  className="px-8 py-4 rounded-2xl bg-gradient-to-r from-yellow-500 to-orange-500 text-white font-black text-lg shadow-[0_10px_40px_-10px_rgba(234,179,8,0.5)] hover:shadow-[0_10px_50px_-10px_rgba(234,179,8,0.7)] hover:scale-105 transition-all flex items-center justify-center gap-3 group"
                >
                  <Star className="w-6 h-6 group-hover:rotate-12 transition-transform" />
                  <span>Upgrade to Pro</span>
                </button>
              )}
              <Button
                onClick={onCreateNew}
                className="px-8 py-4 rounded-2xl bg-white text-slate-900 font-black text-lg shadow-[0_10px_40px_-10px_rgba(255,255,255,0.3)] hover:shadow-[0_10px_50px_-10px_rgba(255,255,255,0.5)] hover:scale-105 transition-all flex items-center justify-center gap-3 group"
              >
                <Plus className="w-6 h-6 group-hover:rotate-90 transition-transform" />
                <span>New Analysis</span>
              </Button>
              {userProfile.tier === 'starter' && (
                <Button
                  onClick={onOpenRedeemCode}
                  className="px-8 py-4 rounded-2xl bg-slate-700 text-white font-black text-lg shadow-[0_10px_40px_-10px_rgba(0,0,0,0.3)] hover:shadow-[0_10px_50px_-10px_rgba(0,0,0,0.5)] hover:scale-105 transition-all flex items-center justify-center gap-3 group"
                >
                  <Gift className="w-6 h-6" /> Redeem Code
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 2. MAIN TOOLS GRID - Premium Cards with Images */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* Card 1: Metadata Analyzer (Indigo) */}
        <button
          onClick={onCreateNew}
          className="group relative overflow-hidden flex flex-col items-start text-left rounded-3xl bg-gradient-to-br from-indigo-600 to-indigo-800 shadow-[0_20px_60px_-15px_rgba(79,70,229,0.4)] hover:shadow-[0_20px_80px_-15px_rgba(79,70,229,0.6)] transition-all duration-500 hover:scale-[1.02] h-full p-0 border-0"
        >
          <div className="absolute inset-0 opacity-40 pointer-events-none">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(129,140,248,0.4),_transparent_55%),_radial-gradient(circle_at_bottom_right,_rgba(56,189,248,0.45),_transparent_55%)] mix-blend-overlay scale-150 rotate-12 group-hover:scale-110 group-hover:rotate-0 transition-all duration-1000" />
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-950 via-indigo-900/40 to-transparent"></div>
          </div>

          {/* Decorative elements */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-700 pointer-events-none"></div>

          <div className="relative z-10 p-8 flex flex-col h-full w-full">
            <div className="flex items-start justify-between mb-6">
              <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-sm text-white flex items-center justify-center group-hover:scale-110 group-hover:rotate-6 transition-all duration-300 shadow-lg">
                <Music className="w-8 h-8" />
              </div>
              <div className="px-3 py-1 rounded-full bg-white/20 backdrop-blur-sm text-white text-xs font-bold uppercase">
                Essential
              </div>
            </div>

            <h3 className="text-2xl font-black text-white mb-3 group-hover:scale-105 transition-transform origin-left">
              Metadata Analyzer
            </h3>
            <p className="text-indigo-100 text-sm leading-relaxed mb-8 font-medium">
              Professional AI tagging. Upload tracks to detect BPM, key, genre, and generate copyright data instantly.
            </p>

            <div className="mt-auto flex items-center text-xs font-bold text-white uppercase tracking-widest group-hover:gap-3 transition-all">
              LAUNCH NOW <ArrowLeft className="w-4 h-4 ml-2 rotate-180 transition-transform group-hover:translate-x-2" />
            </div>
          </div>
        </button>

        {/* Card 2: Batch Processor (Pink/Purple) */}
        <button
          onClick={() => !isPaid ? onOpenPricing() : onCreateNew()}
          className="group relative overflow-hidden flex flex-col items-start text-left rounded-3xl bg-gradient-to-br from-pink-600 via-purple-600 to-violet-700 shadow-[0_20px_60px_-15px_rgba(236,72,153,0.4)] hover:shadow-[0_20px_80px_-15px_rgba(236,72,153,0.6)] transition-all duration-500 hover:scale-[1.02] h-full p-0 border-0"
        >
          {/* Background Pattern */}
          <div className="absolute inset-0 opacity-20 pointer-events-none">
            <div className="absolute inset-0 bg-gradient-to-br from-pink-400 via-purple-500 to-violet-600"></div>
            <div className="absolute inset-0" style={{
              backgroundImage: 'linear-gradient(45deg, rgba(255,255,255,0.1) 25%, transparent 25%, transparent 75%, rgba(255,255,255,0.1) 75%, rgba(255,255,255,0.1)), linear-gradient(45deg, rgba(255,255,255,0.1) 25%, transparent 25%, transparent 75%, rgba(255,255,255,0.1) 75%, rgba(255,255,255,0.1))',
              backgroundSize: '60px 60px',
              backgroundPosition: '0 0, 30px 30px'
            }}></div>
          </div>

          {/* Pro Badge */}
          {!isPaid && (
            <div className="absolute top-4 right-4 z-20">
              <div className="px-4 py-2 rounded-full bg-gradient-to-r from-yellow-400 to-orange-500 text-white text-xs font-black uppercase shadow-lg animate-pulse flex items-center gap-2">
                <Star className="w-4 h-4" /> PRO
              </div>
            </div>
          )}

          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-700 pointer-events-none"></div>

          <div className="relative z-10 p-8 flex flex-col h-full w-full">
            <div className="flex items-start justify-between mb-6">
              <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-sm text-white flex items-center justify-center group-hover:scale-110 group-hover:rotate-6 transition-all duration-300 shadow-lg">
                <Zap className="w-8 h-8" />
              </div>
            </div>

            <h3 className="text-2xl font-black text-white mb-3 group-hover:scale-105 transition-transform origin-left">
              Batch Processor
            </h3>
            <p className="text-pink-100 text-sm leading-relaxed mb-8 font-medium">
              Unlock Pro to analyze unlimited files at once. Process entire albums in seconds and save hours of manual work.
            </p>

            <div className="mt-auto flex items-center text-xs font-bold text-white uppercase tracking-widest group-hover:gap-3 transition-all">
              {!isPaid ? 'UPGRADE TO UNLOCK' : 'LAUNCH NOW'} <ArrowLeft className="w-4 h-4 ml-2 rotate-180 transition-transform group-hover:translate-x-2" />
            </div>
          </div>
        </button>

      </div>

      {/* 3. QUICK ACCESS TOOLS - Modern Grid */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-2xl font-black text-slate-800 dark:text-white">Quick Access Tools</h3>
          <div className="h-px flex-1 ml-6 bg-gradient-to-r from-slate-200 dark:from-slate-800 to-transparent"></div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">

          {/* Copyright Tool */}
          <button
            onClick={() => onNavigate('analyze')}
            className="group relative overflow-hidden flex items-center gap-4 p-6 bg-white dark:bg-[#0f111a] rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-amber-500/50 hover:shadow-[0_10px_40px_-10px_rgba(251,191,36,0.3)] transition-all hover:scale-[1.02]"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-amber-500/0 to-amber-500/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>

            <div className="relative w-14 h-14 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg group-hover:scale-110 group-hover:rotate-3 transition-all">
              <Shield className="w-7 h-7 text-white" />
            </div>

            <div className="relative text-left">
              <p className="font-black text-lg text-slate-900 dark:text-white group-hover:text-amber-500 transition-colors">Copyright</p>
              <p className="text-[11px] uppercase font-bold text-slate-500 tracking-wide">Certificates & Protection</p>
            </div>

            <ArrowLeft className="absolute right-4 w-5 h-5 text-slate-400 rotate-180 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
          </button>

          {/* Identification Tool */}
          <button
            onClick={() => onNavigate('analyze')}
            className="group relative overflow-hidden flex items-center gap-4 p-6 bg-white dark:bg-[#0f111a] rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-cyan-500/50 hover:shadow-[0_10px_40px_-10px_rgba(6,182,212,0.3)] transition-all hover:scale-[1.02]"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/0 to-cyan-500/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>

            <div className="relative w-14 h-14 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg group-hover:scale-110 group-hover:rotate-3 transition-all">
              <Fingerprint className="w-7 h-7 text-white" />
            </div>

            <div className="relative text-left">
              <p className="font-black text-lg text-slate-900 dark:text-white group-hover:text-cyan-500 transition-colors">Identification</p>
              <p className="text-[11px] uppercase font-bold text-slate-500 tracking-wide">ACRCloud & MusicBrainz</p>
            </div>

            <ArrowLeft className="absolute right-4 w-5 h-5 text-slate-400 rotate-180 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
          </button>

          {/* Analytics Tool */}
          <button
            onClick={() => onNavigate('analyze')}
            className="group relative overflow-hidden flex items-center gap-4 p-6 bg-white dark:bg-[#0f111a] rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-violet-500/50 hover:shadow-[0_10px_40px_-10px_rgba(139,92,246,0.3)] transition-all hover:scale-[1.02]"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-violet-500/0 to-violet-500/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>

            <div className="relative w-14 h-14 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg group-hover:scale-110 group-hover:rotate-3 transition-all">
              <LayoutGrid className="w-7 h-7 text-white" />
            </div>

            <div className="relative text-left">
              <p className="font-black text-lg text-slate-900 dark:text-white group-hover:text-violet-500 transition-colors">Analytics</p>
              <p className="text-[11px] uppercase font-bold text-slate-500 tracking-wide">Deep Insights & Reports</p>
            </div>

            <ArrowLeft className="absolute right-4 w-5 h-5 text-slate-400 rotate-180 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
          </button>

          {/* Cloud Storage Tool */}
          <button
            onClick={() => onNavigate('analyze')}
            className="group relative overflow-hidden flex items-center gap-4 p-6 bg-white dark:bg-[#0f111a] rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-emerald-500/50 hover:shadow-[0_10px_40px_-10px_rgba(16,185,129,0.3)] transition-all hover:scale-[1.02]"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/0 to-emerald-500/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>

            <div className="relative w-14 h-14 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg group-hover:scale-110 group-hover:rotate-3 transition-all">
              <Users className="w-7 h-7 text-white" />
            </div>

            <div className="relative text-left">
              <p className="font-black text-lg text-slate-900 dark:text-white group-hover:text-emerald-500 transition-colors">Collaboration</p>
              <p className="text-[11px] uppercase font-bold text-slate-500 tracking-wide">Team Workspace</p>
            </div>

            <ArrowLeft className="absolute right-4 w-5 h-5 text-slate-400 rotate-180 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
          </button>

        </div>
      </div>

      {/* 4. FOOTER LOGOS - Premium Partner Section */}
      <div className="relative pt-16 pb-8">
        {/* Decorative line */}
        <div className="absolute top-8 left-0 right-0 h-px bg-gradient-to-r from-transparent via-slate-200 dark:via-slate-800 to-transparent"></div>

        <div className="text-center space-y-8">
          <div className="inline-flex items-center gap-3 px-6 py-3 rounded-full bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 backdrop-blur-sm">
            <div className="flex -space-x-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 border-2 border-white dark:border-slate-900 flex items-center justify-center">
                <Music className="w-4 h-4 text-white" />
              </div>
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 border-2 border-white dark:border-slate-900 flex items-center justify-center">
                <Globe className="w-4 h-4 text-white" />
              </div>
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-500 to-rose-600 border-2 border-white dark:border-slate-900 flex items-center justify-center">
                <Shield className="w-4 h-4 text-white" />
              </div>
            </div>
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Powered by Industry Leaders</span>
          </div>

          <div className="flex flex-wrap justify-center items-center gap-8 md:gap-16">
            <div className="group flex flex-col items-center gap-2 transition-all hover:scale-110">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-lg group-hover:shadow-green-500/50 transition-all">
                <Music className="w-8 h-8 text-white" />
              </div>
              <span className="text-sm font-black text-slate-400 group-hover:text-green-500 transition-colors">Spotify</span>
            </div>

            <div className="group flex flex-col items-center gap-2 transition-all hover:scale-110">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center shadow-lg group-hover:shadow-blue-500/50 transition-all">
                <Globe className="w-8 h-8 text-white" />
              </div>
              <span className="text-sm font-black text-slate-400 group-hover:text-blue-500 transition-colors">Google Cloud</span>
            </div>

            <div className="group flex flex-col items-center gap-2 transition-all hover:scale-110">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center shadow-lg group-hover:shadow-purple-500/50 transition-all">
                <Fingerprint className="w-8 h-8 text-white" />
              </div>
              <span className="text-sm font-black text-slate-400 group-hover:text-purple-500 transition-colors">ACRCloud</span>
            </div>

            <div className="group flex flex-col items-center gap-2 transition-all hover:scale-110">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center shadow-lg group-hover:shadow-orange-500/50 transition-all">
                <LayoutGrid className="w-8 h-8 text-white" />
              </div>
              <span className="text-sm font-black text-slate-400 group-hover:text-orange-500 transition-colors">MusicBrainz</span>
            </div>
          </div>

          {/* Stats Section */}
          <div className="grid grid-cols-3 gap-8 max-w-2xl mx-auto pt-8">
            <div className="text-center">
              <div className="text-3xl font-black bg-gradient-to-r from-indigo-400 to-purple-400 text-transparent bg-clip-text mb-1">10K+</div>
              <div className="text-xs uppercase font-bold text-slate-600 dark:text-slate-400 tracking-wider">Active Users</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-black bg-gradient-to-r from-emerald-400 to-teal-400 text-transparent bg-clip-text mb-1">500K+</div>
              <div className="text-xs uppercase font-bold text-slate-600 dark:text-slate-400 tracking-wider">Files Analyzed</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-black bg-gradient-to-r from-pink-400 to-rose-400 text-transparent bg-clip-text mb-1">99.9%</div>
              <div className="text-xs uppercase font-bold text-slate-600 dark:text-slate-400 tracking-wider">Accuracy Rate</div>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};

export default DashboardHome;
