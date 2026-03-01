import React, { useState } from 'react';
import Button from './Button';

interface Props {
  metadata: any;
  audioHash?: string;
  onClose?: () => void;
}

export default function IPFSPanel({ metadata, audioHash, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ cid?: string; url?: string; error?: string } | null>(null);
  const [pinResult, setPinResult] = useState<{ cid?: string; url?: string; error?: string } | null>(null);
  const [pinFileResult, setPinFileResult] = useState<{ cid?: string; url?: string; error?: string } | null>(null);
  const [pinFileUploading, setPinFileUploading] = useState(false);

  const handleCertify = async () => {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch('/api/v2/certify-ipfs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioHash: audioHash || 'unknown',
          metadata: {
            title: metadata?.title || 'Untitled',
            artist: metadata?.artist || 'Unknown Artist',
            album: metadata?.album || 'Single',
            year: metadata?.year || undefined,
            isrc: metadata?.isrc || 'Not Assigned',
            copyright: metadata?.copyright || undefined,
            pLine: metadata?.pLine || undefined,
            publisher: metadata?.publisher || 'Independent',
            mainGenre: metadata?.mainGenre || metadata?.genre || 'Unknown',
            duration: metadata?.duration || 0.0,
            fileOwner: metadata?.fileOwner || undefined,
            license: metadata?.license || 'All Rights Reserved'
          }
        })
      });
      if (!res.ok) throw new Error(`IPFS certify failed: ${res.status}`);
      const data = await res.json();
      setResult({ cid: data.cid, url: data.gateway_url });
    } catch (e: any) {
      setResult({ error: e.message });
    } finally {
      setLoading(false);
    }
  };

  const handlePinJson = async () => {
    setPinResult(null);
    try {
      const res = await fetch('/api/pinata/pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payload: {
            title: metadata?.title,
            artist: metadata?.artist,
            album: metadata?.album,
            year: metadata?.year,
            isrc: metadata?.isrc,
            mainGenre: metadata?.mainGenre || metadata?.genre,
          }
        })
      });
      if (!res.ok) throw new Error(`Pin JSON failed: ${res.status}`);
      const data = await res.json();
      setPinResult({ cid: data.cid || data.ipfs_hash, url: data.gateway_url });
    } catch (e: any) {
      setPinResult({ error: e.message });
    }
  };

  const handlePinFile = async (file: File) => {
    setPinFileUploading(true);
    setPinFileResult(null);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/pinata/pin-file', {
        method: 'POST',
        body: form
      });
      if (!res.ok) throw new Error(`Pin file failed: ${res.status}`);
      const data = await res.json();
      setPinFileResult({ cid: data.cid || data.ipfs_hash, url: data.gateway_url });
    } catch (e: any) {
      setPinFileResult({ error: e.message });
    } finally {
      setPinFileUploading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-[#0f111a] rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-black">IPFS Certificate</h3>
        {onClose && <button onClick={onClose} className="text-xs font-bold text-slate-500 hover:text-slate-700">Close</button>}
      </div>
      <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
        Create a decentralized proof of authorship and metadata via IPFS (Pinata).
      </p>
      <div className="flex gap-3 flex-wrap items-center">
        <Button onClick={handleCertify} disabled={loading}>{loading ? 'Submitting...' : 'Certify on IPFS'}</Button>
        {result?.url && (
          <a className="text-sm font-bold text-blue-600 hover:underline" href={result.url} target="_blank" rel="noreferrer">
            View on Gateway
          </a>
        )}
        {result?.error && <span className="text-sm text-red-500">{result.error}</span>}
      </div>

      <div className="mt-4 flex gap-3 flex-wrap items-center">
        <Button variant="secondary" onClick={handlePinJson}>Pin JSON</Button>
        {pinResult?.url && (
          <a className="text-sm font-bold text-blue-600 hover:underline" href={pinResult.url} target="_blank" rel="noreferrer">
            View JSON
          </a>
        )}
        {pinResult?.error && <span className="text-sm text-red-500">{pinResult.error}</span>}
      </div>

      <div className="mt-4 flex gap-3 flex-wrap items-center">
        <input
          type="file"
          className="text-sm"
          onChange={(e) => e.target.files?.[0] && handlePinFile(e.target.files[0])}
        />
        {pinFileUploading && <span className="text-sm text-slate-500">Uploading...</span>}
        {pinFileResult?.url && (
          <a className="text-sm font-bold text-blue-600 hover:underline" href={pinFileResult.url} target="_blank" rel="noreferrer">
            View File
          </a>
        )}
        {pinFileResult?.error && <span className="text-sm text-red-500">{pinFileResult.error}</span>}
      </div>
    </div>
  );
}
