import React from 'react';
import { Copy, Sparkles } from './icons';
import Button from './Button';

interface MarketingModalProps {
  title: string;
  content: string;
  onClose: () => void;
  onCopy: () => void;
}

const MarketingModal: React.FC<MarketingModalProps> = ({ title, content, onClose, onCopy }) => {
  return (
    <div 
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-fade-in"
      onClick={onClose}
    >
      <div 
        className="bg-light-card dark:bg-dark-card rounded-2xl shadow-xl w-full max-w-2xl p-8 border border-slate-200 dark:border-slate-800 relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button 
          onClick={onClose} 
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors" 
          aria-label="Close modal"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-gradient-to-br from-accent-violet to-accent-blue rounded-lg flex items-center justify-center shrink-0">
                <Sparkles className="w-6 h-6 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-light-text dark:text-dark-text tracking-tight">
                {title}
            </h2>
        </div>
        
        <div className="space-y-4 text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800/50 rounded-lg p-4 max-h-[50vh] overflow-y-auto">
            <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
                {content}
            </pre>
        </div>

        <div className="mt-6 flex justify-end gap-4">
             <Button onClick={onClose} variant="secondary">
                Zamknij
            </Button>
            <Button onClick={onCopy} variant="primary">
                <Copy className="w-4 h-4" />
                Kopiuj do schowka
            </Button>
        </div>
      </div>
    </div>
  );
};

export default MarketingModal;