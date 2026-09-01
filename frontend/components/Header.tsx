
import React from 'react';
import { Sun, Moon } from './icons';

interface HeaderProps {
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  openValidationPanel: () => void;
}

import { Database } from './icons';

const Header: React.FC<HeaderProps> = ({ theme, toggleTheme, openValidationPanel }) => {
  return (
    <div className="flex items-center justify-between w-full px-4">
      <a href="/" className="flex items-center gap-3 group">
            <img src="/favicon.svg" alt="Metadata Engine" className="w-10 h-10 shrink-0 transition-transform group-hover:scale-105" />
            <div className="flex flex-col leading-none">
              <span className="text-xl font-black tracking-tight text-white">
                METADATA <span className="text-grad-brand">ENGINE</span>
              </span>
              <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">HardbanRecords Lab</span>
            </div>
          </a>

      <div className="flex items-center gap-2">
        <button
        onClick={toggleTheme}
        className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
        aria-label="Toggle theme"
      >
        {theme === 'dark' ? (
          <Sun className="w-5 h-5 text-yellow-400" />
        ) : (
          <Moon className="w-5 h-5 text-slate-600" />
        )}
      </button>
      <button
        onClick={openValidationPanel}
        className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
        aria-label="Open validation panel"
      >
        🛠️
      </button>
      </div>
    </div>
  );
};

export default Header;
