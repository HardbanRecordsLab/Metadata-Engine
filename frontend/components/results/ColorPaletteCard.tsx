
import React from 'react';
import Card from './Card';
import { Palette, Copy, Sparkles, RefreshCw } from '../icons';
import Button from '../Button';
import Tooltip from '../Tooltip';

interface ColorPaletteCardProps {
  palette: string[] | null;
  description: string | null;
  isGenerating: boolean;
  onGenerate: () => void;
  showToast: (message: string) => void;
}

const ColorPaletteCard: React.FC<ColorPaletteCardProps> = ({ palette, description, isGenerating, onGenerate, showToast }) => {

  const handleCopy = (hex: string) => {
    navigator.clipboard.writeText(hex);
    showToast(`Copied ${hex}!`);
  };

  return (
    <Card>
      <div className="flex items-center gap-3 border-b border-slate-200 dark:border-slate-800 pb-4 mb-4">
        <div className="w-10 h-10 flex items-center justify-center rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 text-white">
          <Palette className="w-6 h-6" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-light-text dark:text-dark-text">Color Palette</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">Visual Identity.</p>
        </div>
      </div>

      <div className="space-y-4">
        {isGenerating ? (
          <div className="flex flex-col items-center justify-center text-center space-y-4 py-10">
            <div className="w-12 h-12 border-4 border-accent-violet border-t-transparent rounded-full animate-spin"></div>
            <p className="font-semibold text-light-text dark:text-dark-text">Creating palette...</p>
          </div>
        ) : palette ? (
          <div className="animate-fade-in space-y-3">
            <div className="flex justify-center gap-2 flex-wrap">
              {palette.map(hex => (
                <Tooltip key={hex} text={hex}>
                  <button onClick={() => handleCopy(hex)} className="relative w-12 h-12 rounded-lg group border border-slate-200 dark:border-slate-700" style={{ backgroundColor: hex }}>
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity rounded-lg">
                      <Copy className="w-5 h-5 text-white" />
                    </div>
                  </button>
                </Tooltip>
              ))}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 text-center italic">{description}</p>
          </div>
        ) : (
          <div className="text-center p-4">
             <Palette className="w-12 h-12 text-slate-400 dark:text-slate-500 mx-auto" />
             <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 mb-4">
               Generate a color palette matching your music's mood.
             </p>
          </div>
        )}

        <Button onClick={onGenerate} disabled={isGenerating} variant={palette ? 'secondary' : 'primary'} size="sm" className="w-full">
          {isGenerating ? 'Generating...' : palette ? <><RefreshCw className="w-4 h-4" /> Regenerate</> : <><Sparkles className="w-4 h-4" /> Generate Palette</>}
        </Button>
      </div>
    </Card>
  );
};

export default ColorPaletteCard;
