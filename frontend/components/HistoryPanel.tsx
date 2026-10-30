
import React from 'react';
import { AnalysisRecord } from '../types';
import { Music, Lightbulb, Search, ChevronDown, ChevronUp, X } from './icons';
import { coverage, embedQuery, findDuplicates, findSimilar, rankBySimilarity, type Hit } from '../services/librarySearch';

/** What the list shows instead of the plain history: a ranking by sound, or groups of the same recording. */
type SoundView = { kind: 'hits'; title: string; hits: Hit[] } | { kind: 'duplicates'; groups: AnalysisRecord[][] } | null;

interface HistoryPanelProps {
  history: AnalysisRecord[];
  onSelectItem: (record: AnalysisRecord) => void;
}

const HistoryPanel: React.FC<HistoryPanelProps> = ({ history, onSelectItem }) => {
  const [searchQuery, setSearchQuery] = React.useState('');
  const [selectedGenre, setSelectedGenre] = React.useState<string>('All');
  const [bpmRange, setBpmRange] = React.useState<[number, number]>([0, 300]);
  const [sortBy, setSortBy] = React.useState<'recent' | 'alphabetical'>('recent');
  const [isFilterExpanded, setIsFilterExpanded] = React.useState(false);
  const [soundQuery, setSoundQuery] = React.useState('');
  const [soundBusy, setSoundBusy] = React.useState(false);
  const [soundError, setSoundError] = React.useState<string | null>(null);
  const [soundView, setSoundView] = React.useState<SoundView>(null);
  const cov = React.useMemo(() => coverage(history), [history]);

  const runSoundSearch = async () => {
    setSoundError(null);
    setSoundBusy(true);
    try {
      const q = await embedQuery(soundQuery);
      setSoundView({ kind: 'hits', title: `Sounds like “${soundQuery.trim()}”`, hits: rankBySimilarity(q, history, 20) });
    } catch (e) {
      setSoundError(e instanceof Error ? e.message : 'Sound search failed.');
    } finally {
      setSoundBusy(false);
    }
  };
  const showSimilar = (record: AnalysisRecord) => {
    setSoundError(null);
    setSoundView({ kind: 'hits', title: `Sounds like “${getTitle(record)}”`, hits: findSimilar(record, history, 20) });
  };
  const showDuplicates = () => {
    setSoundError(null);
    setSoundView({ kind: 'duplicates', groups: findDuplicates(history) });
  };

  const genres = ['All', ...Array.from(new Set(history.map(r => r.metadata.mainGenre).filter(Boolean)))];

  const filteredHistory = history.filter(record => {
    const title = (record.inputType === 'idea' ? record.input.description : record.input.fileName || record.input.link || '').toLowerCase();
    const artist = (record.metadata.artist || '').toLowerCase();
    const album = (record.metadata.album || '').toLowerCase();
    const query = searchQuery.toLowerCase();

    const matchesSearch = title.includes(query) || artist.includes(query) || album.includes(query);
    const matchesGenre = selectedGenre === 'All' || record.metadata.mainGenre === selectedGenre;
    const recordBpm = Number(record.metadata.bpm) || 0;
    const matchesBpm = recordBpm >= bpmRange[0] && recordBpm <= bpmRange[1];

    return matchesSearch && matchesGenre && matchesBpm;
  }).sort((a, b) => {
    if (sortBy === 'recent') return 0; // History is usually passed pre-sorted by date
    const titleA = (a.inputType === 'idea' ? a.input.description : a.input.fileName || '').toLowerCase();
    const titleB = (b.inputType === 'idea' ? b.input.description : b.input.fileName || '').toLowerCase();
    return titleA.localeCompare(titleB);
  });

  const getTitle = (record: AnalysisRecord) => {
    if (record.inputType === 'idea') {
      return record.input.description || 'Generated Idea';
    }
    return record.input.fileName || record.input.link || 'File Analysis';
  };

  const renderItem = (record: AnalysisRecord, chip?: string) => (
    <div key={record.id} className="flex items-stretch gap-2">
      <button
        onClick={() => onSelectItem(record)}
        className="flex-1 min-w-0 text-left bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/50 rounded-xl p-4 transition-all hover:bg-slate-50 dark:hover:bg-slate-750 hover:border-accent-violet/30 hover:shadow-lg group shadow-sm"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-900 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
            {record.inputType === 'idea'
              ? <Lightbulb className="w-5 h-5 text-amber-500" />
              : <Music className="w-5 h-5 text-accent-blue" />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-bold text-sm truncate text-light-text dark:text-dark-text leading-tight mb-1" title={getTitle(record)}>
              {getTitle(record)}
            </p>
            <div className="flex items-center gap-2">
              <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 dark:bg-slate-900 rounded text-slate-500 font-medium">
                {record.metadata.mainGenre}
              </span>
              <span className="text-[10px] text-slate-400">
                {record.metadata.bpm} BPM • {record.metadata.key} {record.metadata.mode}
              </span>
            </div>
          </div>
          {chip && <span className="text-xs font-black text-accent-violet shrink-0">{chip}</span>}
        </div>
      </button>
      {(record.metadata as { sonicVector?: string }).sonicVector && (
        <button
          onClick={() => showSimilar(record)}
          title="Find tracks in your history that sound like this one"
          className="px-2 rounded-xl border border-slate-200 dark:border-slate-700/50 text-[10px] font-bold uppercase tracking-wider text-slate-400 hover:text-accent-violet hover:border-accent-violet/40"
        >
          Similar
        </button>
      )}
    </div>
  );

  return (
    <div className="bg-light-card dark:bg-dark-card rounded-2xl shadow-lg p-6 border border-slate-200 dark:border-slate-800 h-full flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold text-light-text dark:text-dark-text">Repository History</h3>
        <span className="text-xs bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-full text-slate-500">
          {filteredHistory.length} items
        </span>
      </div>

      <div className="flex items-center gap-2 mb-4 p-1 bg-slate-100 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
        <button
          onClick={() => setSortBy('recent')}
          className={`flex-1 px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all ${sortBy === 'recent' ? 'bg-white dark:bg-slate-800 shadow-sm text-accent-violet' : 'text-slate-400 hover:text-slate-600'}`}
        >
          Recent
        </button>
        <button
          onClick={() => setSortBy('alphabetical')}
          className={`flex-1 px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all ${sortBy === 'alphabetical' ? 'bg-white dark:bg-slate-800 shadow-sm text-accent-violet' : 'text-slate-400 hover:text-slate-600'}`}
        >
          A-Z
        </button>
      </div>

      <div className="mb-4 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 space-y-2">
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Describe the sound, e.g. dark driving techno for a chase scene"
            value={soundQuery}
            maxLength={300}
            onChange={(e) => setSoundQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && soundQuery.trim() && !soundBusy && cov.withVector) runSoundSearch(); }}
            className="flex-1 min-w-0 px-3 py-2 bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-lg text-xs outline-none focus:ring-2 focus:ring-accent-violet"
          />
          <button
            onClick={runSoundSearch}
            disabled={!soundQuery.trim() || soundBusy || !cov.withVector}
            className="px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-accent-violet text-white disabled:opacity-40"
          >
            {soundBusy ? 'Listening…' : 'Search by sound'}
          </button>
        </div>
        <div className="flex items-center justify-between text-[10px] text-slate-500">
          <span>
            {cov.withVector === cov.total
              ? `All ${cov.total} tracks can be searched by sound.`
              : `${cov.withVector} of ${cov.total} tracks can be searched by sound; older analyses have no sound fingerprint.`}
          </span>
          <button onClick={showDuplicates} disabled={cov.withVector < 2} className="font-bold uppercase tracking-wider text-accent-violet disabled:opacity-40 disabled:no-underline underline">
            Find duplicates
          </button>
        </div>
        {soundError && <p className="text-[11px] text-red-500">{soundError}</p>}
      </div>

      <div className="space-y-4 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by filename or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:ring-2 focus:ring-accent-violet outline-none transition-all"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        <button
          onClick={() => setIsFilterExpanded(!isFilterExpanded)}
          className="flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 uppercase tracking-wider"
        >
          {isFilterExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          Advanced Filters
        </button>

        {isFilterExpanded && (
          <div className="p-4 bg-slate-50 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-800 rounded-xl space-y-4 animate-slide-down">
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase mb-2">Genre Filter</label>
              <select
                value={selectedGenre}
                onChange={(e) => setSelectedGenre(e.target.value)}
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs outline-none"
              >
                {genres.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase mb-2">
                BPM Range: {bpmRange[0]} - {bpmRange[1]}
              </label>
              <div className="flex gap-4">
                <input
                  type="range"
                  min="0" max="250"
                  value={bpmRange[1]}
                  onChange={(e) => setBpmRange([bpmRange[0], Number(e.target.value)])}
                  className="w-full accent-accent-violet"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {soundView && (
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-bold text-slate-500 truncate" title={soundView.kind === 'hits' ? soundView.title : undefined}>
            {soundView.kind === 'hits'
              ? soundView.title
              : soundView.groups.length ? `${soundView.groups.length} group(s) of the same recording` : 'No duplicates found'}
          </p>
          <button onClick={() => setSoundView(null)} className="text-[10px] font-bold uppercase tracking-wider text-slate-400 hover:text-slate-600 flex items-center gap-1">
            <X className="w-3 h-3" /> Back to history
          </button>
        </div>
      )}

      {soundView?.kind === 'duplicates' ? (
        <div className="flex-1 space-y-4 overflow-y-auto pr-2 custom-scrollbar">
          {soundView.groups.map((group, gi) => (
            <div key={gi} className="rounded-xl border border-amber-300/50 bg-amber-50/40 dark:bg-amber-900/10 p-2 space-y-2">
              <p className="text-[10px] font-black uppercase tracking-wider text-amber-600 px-1">Same recording, {group.length} analyses</p>
              {group.map((record) => renderItem(record))}
            </div>
          ))}
        </div>
      ) : soundView?.kind === 'hits' ? (
        soundView.hits.length === 0 ? (
          <p className="text-slate-500 italic text-sm text-center p-8">No track in your history has a sound fingerprint to compare with.</p>
        ) : (
          <div className="flex-1 space-y-3 overflow-y-auto pr-2 custom-scrollbar">
            {soundView.hits.map((h) => renderItem(h.record, `${Math.round(h.similarity * 100)}%`))}
          </div>
        )
      ) : filteredHistory.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-8 opacity-50">
          <Music className="w-12 h-12 mb-4 text-slate-300" />
          <p className="text-slate-500 italic text-sm">No results match your criteria.</p>
          <button onClick={() => { setSearchQuery(''); setSelectedGenre('All'); setBpmRange([0, 300]); }} className="text-accent-violet text-xs mt-2 underline">
            Reset all filters
          </button>
        </div>
      ) : (
        <div className="flex-1 space-y-3 overflow-y-auto pr-2 custom-scrollbar">
          {filteredHistory.map((record) => renderItem(record))}
        </div>
      )}
    </div>
  );
};

export default HistoryPanel;
