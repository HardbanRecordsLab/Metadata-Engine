
import React, { useState } from 'react';
import { Music, CheckCircle2, XCircle, Clock } from './icons';

interface AboutModalProps {
  onClose: () => void;
}

const StatusItem: React.FC<{ label: string; status: 'ready' | 'pending' | 'in-progress' }> = ({ label, status }) => {
    const config = {
        ready: { icon: CheckCircle2, color: 'text-green-500', text: 'Ready' },
        pending: { icon: XCircle, color: 'text-red-500', text: 'Required' },
        'in-progress': { icon: Clock, color: 'text-yellow-500', text: 'In Progress' },
    };
    const { icon: Icon, color, text } = config[status];

    return (
        <div className="flex items-center justify-between p-3 bg-slate-100 dark:bg-slate-800/50 rounded-lg">
            <span className="font-medium text-sm">{label}</span>
            <div className={`flex items-center gap-2 text-xs font-bold ${color}`}>
                <Icon className="w-4 h-4" />
                {text}
            </div>
        </div>
    );
};

const AboutModal: React.FC<AboutModalProps> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState<'about' | 'roadmap'>('about');

  return (
    <div 
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-fade-in"
      onClick={onClose}
    >
      <div 
        className="bg-light-card dark:bg-dark-card rounded-2xl shadow-xl w-full max-w-2xl border border-slate-200 dark:border-slate-800 relative overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
             <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-accent-violet to-accent-blue rounded-lg flex items-center justify-center shrink-0">
                    <Music className="w-6 h-6 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-light-text dark:text-dark-text tracking-tight">
                    Music Metadata Engine <span className="text-xs px-2 py-1 bg-accent-violet/10 text-accent-violet rounded-full ml-2 border border-accent-violet/20">v1.3 BETA</span>
                </h2>
            </div>
            <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors" aria-label="Close modal">
                <svg className="w-6 h-6 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 dark:border-slate-800">
            <button 
                onClick={() => setActiveTab('about')}
                className={`flex-1 py-3 text-sm font-semibold transition-colors ${activeTab === 'about' ? 'text-accent-violet border-b-2 border-accent-violet' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
            >
                About App
            </button>
             <button 
                onClick={() => setActiveTab('roadmap')}
                className={`flex-1 py-3 text-sm font-semibold transition-colors ${activeTab === 'roadmap' ? 'text-accent-violet border-b-2 border-accent-violet' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
            >
                Status & Roadmap
            </button>
        </div>
        
        {/* Content */}
        <div className="p-6 overflow-y-auto text-slate-600 dark:text-slate-300 space-y-4 flex-grow">
            {activeTab === 'about' ? (
                <>
                    <p>
                        <strong>Music Metadata Engine</strong> is a modern tool for producers, DJs, and creators, automating the tedious process of music cataloging using AI.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-4">
                        <div className="p-4 bg-slate-100 dark:bg-slate-800/50 rounded-lg">
                             <h4 className="font-bold text-light-text dark:text-dark-text mb-2">For Creators</h4>
                             <p className="text-sm">Automatic BPM, key, and genres. Generate descriptions and social media posts.</p>
                        </div>
                         <div className="p-4 bg-slate-100 dark:bg-slate-800/50 rounded-lg">
                             <h4 className="font-bold text-light-text dark:text-dark-text mb-2">Technology</h4>
                             <p className="text-sm">Powered by Gemini and local DSP. Built with React + TypeScript.</p>
                        </div>
                    </div>
                    <p className="text-sm italic text-slate-500">
                        Application in demonstration version (Client-Side). Requires own API key for some features.
                    </p>
                </>
            ) : (
                <div className="space-y-6">
                    <div>
                        <h3 className="text-lg font-bold text-light-text dark:text-dark-text mb-3">Go-Live Readiness</h3>
                        <div className="space-y-2">
                            <StatusItem label="Frontend & UI/UX" status="ready" />
                            <StatusItem label="Gemini API Integration" status="ready" />
                            <StatusItem label="Batch Processing" status="ready" />
                            <StatusItem label="Backend Proxy (Key Protection)" status="pending" />
                            <StatusItem label="User Accounts System (Auth)" status="pending" />
                            <StatusItem label="Payments (Stripe/LemonSqueezy)" status="pending" />
                            <StatusItem label="Legal Documents (GDPR, TOS)" status="pending" />
                        </div>
                    </div>
                    
                    <div>
                        <h3 className="text-lg font-bold text-light-text dark:text-dark-text mb-3">Development Roadmap</h3>
                        <ol className="relative border-l border-slate-200 dark:border-slate-700 ml-3 space-y-6">
                            <li className="mb-2 ml-6">
                                <span className="absolute flex items-center justify-center w-6 h-6 bg-green-200 rounded-full -left-3 ring-4 ring-white dark:ring-slate-900 dark:bg-green-900">
                                    <svg className="w-3 h-3 text-green-600 dark:text-green-300" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 16 12">
                                        <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M1 5.917 5.724 10.5 15 1.5"/>
                                    </svg>
                                </span>
                                <h3 className="font-medium leading-tight text-light-text dark:text-dark-text">Phase 1: MVP (Current)</h3>
                                <p className="text-sm text-slate-500">Full client functionality, local analysis, no backend.</p>
                            </li>
                             <li className="mb-2 ml-6">
                                <span className="absolute flex items-center justify-center w-6 h-6 bg-slate-200 rounded-full -left-3 ring-4 ring-white dark:ring-slate-900 dark:bg-slate-700">
                                    <Clock className="w-3 h-3 text-slate-600 dark:text-slate-300" />
                                </span>
                                <h3 className="font-medium leading-tight text-light-text dark:text-dark-text">Phase 2: Infrastructure (Q1 2026)</h3>
                                <p className="text-sm text-slate-500">Firebase/Supabase implementation, secure API Proxy, user accounts.</p>
                            </li>
                            <li className="mb-2 ml-6">
                                <span className="absolute flex items-center justify-center w-6 h-6 bg-slate-200 rounded-full -left-3 ring-4 ring-white dark:ring-slate-900 dark:bg-slate-700">
                                    <span className="text-xs font-bold text-slate-600 dark:text-slate-300">3</span>
                                </span>
                                <h3 className="font-medium leading-tight text-light-text dark:text-dark-text">Phase 3: Commercialization (Q2 2026)</h3>
                                <p className="text-sm text-slate-500">Subscription plans, B2B API, DAW plugins.</p>
                            </li>
                        </ol>
                    </div>
                </div>
            )}
        </div>
        
        {/* Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 text-center">
            <a href="mailto:contact@musicmetadata.ai" className="text-sm text-accent-violet hover:underline font-semibold">
                Contact Developer / Investor
            </a>
        </div>
      </div>
    </div>
  );
};

export default AboutModal;
