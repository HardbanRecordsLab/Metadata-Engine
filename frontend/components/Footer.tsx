
import React from 'react';
import { Music } from './icons';
import { LegalDocType } from './LegalModal';
import { ResourceDocType } from './ResourcesModal';

interface FooterProps {
  onOpenLegal: (type: LegalDocType) => void;
  onOpenResource?: (type: ResourceDocType) => void; 
}

const Footer: React.FC<FooterProps> = ({ onOpenLegal, onOpenResource }) => {
  const currentYear = new Date().getFullYear();
  
  const handleResourceClick = (type: ResourceDocType) => {
      if (onOpenResource) onOpenResource(type);
  };

  return (
    <footer className="bg-white dark:bg-dark-card border-t border-slate-200 dark:border-slate-800 mt-12 py-12 transition-colors duration-300">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          <div className="col-span-1 md:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-gradient-to-br from-accent-violet to-accent-blue rounded-lg flex items-center justify-center">
                <Music className="w-5 h-5 text-white" />
              </div>
              <span className="font-bold text-lg text-light-text dark:text-dark-text">Music Metadata</span>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
              AI-Powered Metadata Automation for Music Professionals. 
              <br/>
              <span className="text-xs opacity-75">Engineered by HardbanRecords Lab.</span>
            </p>
          </div>
          
          <div>
            <h4 className="font-bold text-light-text dark:text-dark-text mb-4">Product</h4>
            <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
              <li><button onClick={() => handleResourceClick('features')} className="hover:text-accent-violet transition-colors text-left">Features</button></li>
              <li><button onClick={() => handleResourceClick('pricing')} className="hover:text-accent-violet transition-colors text-left">Pricing & Plans</button></li>
              <li><button onClick={() => handleResourceClick('api')} className="hover:text-accent-violet transition-colors text-left">API for Developers</button></li>
              <li><button onClick={() => handleResourceClick('roadmap')} className="hover:text-accent-violet transition-colors text-left">Development Roadmap</button></li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-light-text dark:text-dark-text mb-4">Resources</h4>
            <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
              <li><button onClick={() => handleResourceClick('docs')} className="hover:text-accent-violet transition-colors text-left">Documentation</button></li>
              <li><button onClick={() => handleResourceClick('help')} className="hover:text-accent-violet transition-colors text-left">FAQ & Support</button></li>
              <li><button onClick={() => handleResourceClick('status')} className="hover:text-accent-violet transition-colors text-left">System Status</button></li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-light-text dark:text-dark-text mb-4">Legal</h4>
            <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
              <li><button onClick={() => onOpenLegal('tos')} className="hover:text-accent-violet transition-colors text-left">Terms of Service</button></li>
              <li><button onClick={() => onOpenLegal('privacy')} className="hover:text-accent-violet transition-colors text-left">Privacy Policy</button></li>
              <li><button onClick={() => onOpenLegal('gdpr')} className="hover:text-accent-violet transition-colors text-left">GDPR Compliance</button></li>
              <li><button onClick={() => onOpenLegal('cookies')} className="hover:text-accent-violet transition-colors text-left">Cookie Policy</button></li>
              <li><button onClick={() => onOpenLegal('ai_disclaimer')} className="hover:text-accent-violet transition-colors text-left font-semibold text-yellow-600 dark:text-yellow-500">AI Disclaimer</button></li>
            </ul>
          </div>
        </div>
        
        <div className="border-t border-slate-200 dark:border-slate-800 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex flex-col md:flex-row md:items-center gap-2">
            <p className="text-xs text-slate-400">
                &copy; {currentYear} Music Metadata Engine | HardbanRecords Lab
            </p>
            <span className="hidden md:block text-slate-600">•</span>
            <p className="text-xs text-slate-400">All rights reserved.</p>
          </div>
          <div className="flex gap-4">
             {/* Social Links */}
             <a href="#" className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-all cursor-pointer" aria-label="X (Twitter)">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
             </a>
             <a href="#" className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 hover:bg-[#0077b5] hover:text-white transition-all cursor-pointer" aria-label="LinkedIn">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
             </a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
