import React, { useState, useEffect } from 'react';
import { Metadata, MBRecording } from '../../types';
import { searchMusicBrainz, mapMBToMetadata } from '../../services/musicBrainzService';
import Card from './Card';
import { Database, SearchCheck, CheckCircle2, User, Calendar, Fingerprint, Music } from '../icons';
import { identifyTrack } from '../../services/enhanced/acrCloudService';
import Button from '../Button';
import Tooltip from '../Tooltip';

interface IdentificationCardProps {
  metadata: Metadata;
  fileName?: string;
  uploadedFile?: File | null;
  onUpdateMetadata: (newMetadata: Partial<Metadata>) => void;
  showToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

const IdentificationCard: React.FC<IdentificationCardProps> = ({ metadata, fileName, uploadedFile, onUpdateMetadata, showToast }) => {
  const [isOpen, setIsOpen] = useState(true);

  // MusicBrainz State
  const [mbQuery, setMbQuery] = useState('');
  const [mbResults, setMbResults] = useState<MBRecording[]>([]);
  const [isMbSearching, setIsMbSearching] = useState(false);

  // ACRCloud State
  const [acrResult, setAcrResult] = useState<any>(null);
  const [isAcrSearching, setIsAcrSearching] = useState(false);

  // Initialize MB query logic with ISRC support
  useEffect(() => {
    if (metadata.isrc && metadata.isrc.length > 5) {
      // Priority to ISRC if available
      setMbQuery(`isrc:${metadata.isrc}`);
    } else if (metadata.artist && metadata.title && metadata.title !== 'Unknown') {
      // Use simple Artist - Title syntax for broad match, or quotes for exact
      setMbQuery(`${metadata.artist} - ${metadata.title}`);
    } else if (fileName) {
      const cleanName = fileName.replace(/\.[^/.]+$/, "").replace(/_/g, " ").replace(/-/g, " ");
      setMbQuery(cleanName);
    }
  }, [metadata.title, metadata.artist, fileName, metadata.isrc]);

  const handleMbSearch = async () => {
    if (!mbQuery.trim()) return;
    setIsMbSearching(true);
    setMbResults([]);
    try {
      const data = await searchMusicBrainz(mbQuery);
      if (data.length === 0) {
        showToast("No matching records found in Institutional Registry.", 'info');
      }
      setMbResults(data);
    } catch (error) {
      showToast("Institutional Registry connection error.", 'error');
    } finally {
      setIsMbSearching(false);
    }
  };

  const handleMbApply = async (recording: MBRecording) => {
    const mappedData = mapMBToMetadata(recording);
    onUpdateMetadata(mappedData);
    showToast("Metadata updated from Institutional Registry!", 'success');
    setMbResults([]);
  };

  const handleAcrIdentify = async () => {
    if (!uploadedFile) {
      showToast("No file loaded for acoustic fingerprinting.", 'error');
      return;
    }

    setIsAcrSearching(true);
    setAcrResult(null);
    try {
      showToast("Generating acoustic fingerprint...", 'info');
      const result = await identifyTrack(uploadedFile);
      if (result) {
        setAcrResult(result);
        showToast("Track identified via ACRCloud!", 'success');
      } else {
        showToast("No match found in ACRCloud database.", 'info');
      }
    } catch (error: any) {
      console.error("ACR Error:", error);
      showToast(error.message || "ACRCloud identification failed.", 'error');
    } finally {
      setIsAcrSearching(false);
    }
  };

  const handleAcrApply = () => {
    if (!acrResult) return;
    onUpdateMetadata(acrResult);
    showToast("Metadata updated from ACRCloud!", 'success');
    setAcrResult(null);
  };

  return (
    <Card className="border-l-4 border-l-orange-500">
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 flex items-center justify-center rounded-lg transition-colors bg-orange-100 dark:bg-orange-900/30 text-orange-600">
            <Database className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-light-text dark:text-dark-text">Institutional Registry</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Global Rights Metadata Search
            </p>
          </div>
        </div>
        <button onClick={() => setIsOpen(!isOpen)} className="text-xs font-semibold text-accent-violet hover:underline">
          {isOpen ? 'Collapse' : 'Expand'}
        </button>
      </div>

      {isOpen && (
        <div className="animate-fade-in">
          {/* MusicBrainz Content */}
          <div className="animate-fade-in">
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={mbQuery}
                onChange={(e) => setMbQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleMbSearch()}
                placeholder="Artist - Title or isrc:CODE"
                className="flex-grow p-2 bg-slate-100 dark:bg-slate-800 rounded-md text-sm border border-slate-300 dark:border-slate-600 focus:ring-accent-violet focus:border-accent-violet"
              />
              <Button onClick={handleMbSearch} disabled={isMbSearching} size="sm" variant="primary">
                {isMbSearching ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <SearchCheck className="w-4 h-4" />}
                Search
              </Button>
            </div>

            {mbQuery.startsWith('isrc:') && (
              <p className="text-xs text-emerald-600 dark:text-emerald-400 mb-2 font-medium">
                ISRC code detected. Search will be very precise.
              </p>
            )}

            {mbResults.length > 0 && (
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1 custom-scrollbar bg-slate-50 dark:bg-slate-900/30 p-2 rounded-lg border border-slate-200 dark:border-slate-800">
                {mbResults.map(rec => {
                  const release = rec.releases?.[0];
                  const year = release?.date ? release.date.substring(0, 4) : 'N/A';
                  const label = release?.['label-info']?.[0]?.label?.name;
                  return (
                    <div key={rec.id} className="flex items-center justify-between p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors group">
                      <div className="min-w-0 pr-2">
                        <div className="font-bold text-sm text-light-text dark:text-dark-text truncate">{rec.title}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-x-3 gap-y-1">
                          <span className="flex items-center gap-1"><User className="w-3 h-3" /> {rec['artist-credit']?.[0]?.name}</span>
                          <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {year}</span>
                          {label && <span className="italic opacity-75">{label}</span>}
                        </div>
                      </div>
                      <Tooltip text="Use these data">
                        <button onClick={() => handleMbApply(rec)} className="p-2 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-full hover:bg-green-200 dark:hover:bg-green-900 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100">
                          <CheckCircle2 className="w-4 h-4" />
                        </button>
                      </Tooltip>
                    </div>
                  );
                })}
              </div>
            )}
            {mbResults.length === 0 && !isMbSearching && (
              <div className="text-center py-4">
                <p className="text-xs text-slate-400 italic">Enter artist name and title or ISRC code to find professional metadata.</p>
              </div>
            )}
          </div>

          {/* ACRCloud Section */}
          <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-[#3B82F6] font-bold text-sm uppercase">
                <Fingerprint className="w-5 h-5" />
                Acoustic Fingerprinting
              </div>
              <Button
                onClick={handleAcrIdentify}
                disabled={isAcrSearching || !uploadedFile}
                size="sm"
                variant="secondary"
                className="border-[#3B82F6] text-[#3B82F6] hover:bg-blue-500/5"
              >
                {isAcrSearching ? (
                  <div className="w-4 h-4 border-2 border-[#3B82F6] border-t-transparent rounded-full animate-spin" />
                ) : (
                  "Identify Audio"
                )}
              </Button>
            </div>

            {acrResult ? (
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800 animate-slide-up">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-2">
                    <Music className="w-5 h-5 text-blue-600" />
                    <span className="font-bold text-blue-900 dark:text-blue-100">Match Found</span>
                  </div>
                  <button
                    onClick={handleAcrApply}
                    className="text-xs px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-shadow shadow-sm"
                  >
                    Apply Metadata
                  </button>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-bold text-blue-800 dark:text-blue-200">{acrResult.title}</p>
                  <p className="text-xs text-blue-600 dark:text-blue-400">{acrResult.artist}</p>
                  {acrResult.album && <p className="text-[10px] text-blue-500 italic">{acrResult.album}</p>}
                </div>
              </div>
            ) : !isAcrSearching && (
              <p className="text-center py-2 text-xs text-slate-400 italic">
                Use ACRCloud to identify the track using its audio signature.
              </p>
            )}
          </div>
        </div>
      )}
    </Card>
  );
};

export default IdentificationCard;
