
import React from 'react';
import { Sun, Moon } from './icons';

interface HeaderProps {
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  openValidationPanel: () => void;
}

const Header: React.FC<HeaderProps> = ({ theme, toggleTheme, openValidationPanel }) => {
  return (
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
  );
};

export default Header;
