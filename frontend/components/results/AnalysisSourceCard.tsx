
import React from 'react';
import { AnalysisRecord } from '../../types';
import { Music, Lightbulb } from '../icons';

interface AnalysisSourceCardProps {
  analysis: AnalysisRecord | null;
}

const AnalysisSourceCard: React.FC<AnalysisSourceCardProps> = ({ analysis }) => {
  if (!analysis) return null;

  const { inputType, input } = analysis;
  let icon: React.ReactNode;
  let title: string;
  let content: string | undefined;

  if (inputType === 'idea') {
    icon = <Lightbulb className="w-5 h-5 text-accent-violet" />;
    title = 'Generated from Idea';
    content = input.description;
  } else {
    icon = <Music className="w-5 h-5 text-accent-blue" />;
    if (input.fileName) {
      title = 'Analyzed File';
      content = input.fileName;
    } else if (input.link) {
      title = 'Analyzed from Link';
      content = input.link;
    } else {
      title = 'Analysis Source';
      content = 'Unknown Source';
    }
  }

  return (
    <div className="p-4 bg-slate-100 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700 flex items-start gap-4">
      <div className="flex-shrink-0 mt-1">{icon}</div>
      <div>
        <h4 className="font-bold text-light-text dark:text-dark-text">{title}</h4>
        {content && (
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 italic break-all">
                {inputType === 'idea' ? `"${content}"` : content}
            </p>
        )}
      </div>
    </div>
  );
};

export default AnalysisSourceCard;
