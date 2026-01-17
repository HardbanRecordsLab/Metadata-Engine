import React from 'react';
import { Metadata } from '../types';
import { Shield, Globe, Clock, FileSignature, Music, Hash, ShieldCheck, X } from './icons';

interface CertificateViewerProps {
    metadata: Metadata;
    sha256: string;
    timestamp: string;
    ipfsUrl?: string;
    ipfsHash?: string;
    onClose: () => void;
}

const CertificateViewer: React.FC<CertificateViewerProps> = ({
    metadata, sha256, timestamp, ipfsUrl, ipfsHash, onClose
}) => {

    // Helper to join arrays
    const join = (arr?: string[]) => arr && arr.length ? arr.join(', ') : 'None';

    // Parse duration
    const formatDuration = (seconds?: number) => {
        if (!seconds) return '0:00';
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    // PDF-style White Paper Design
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/90 backdrop-blur-md p-4 animate-fade-in overflow-y-auto">
            {/* Certificate Container - A4-ish Aspect Ratio */}
            <div className="relative w-full max-w-[900px] bg-white text-slate-900 shadow-2xl my-10 min-h-[1100px] flex flex-col font-sans">

                {/* Decorative Border (Double Line) */}
                <div className="absolute inset-2 border-[3px] border-amber-600 rounded-sm pointer-events-none"></div>
                <div className="absolute inset-1 border border-amber-600/30 rounded-sm pointer-events-none"></div>

                {/* Main Content Area */}
                <div className="p-12 md:p-16 flex-1 flex flex-col gap-10">

                    {/* HEADER */}
                    <div className="text-center space-y-4">
                        <div className="flex justify-center">
                            <ShieldCheck className="w-16 h-16 text-amber-600" strokeWidth={1.5} />
                        </div>
                        <div>
                            <h1 className="text-3xl md:text-4xl font-serif font-bold text-amber-700 tracking-wider uppercase mb-1">Digital Footprint Certificate</h1>
                            <p className="text-sm font-semibold tracking-[0.2em] text-slate-500 uppercase">Proof of Existence & Record of Authenticity</p>
                            <p className="text-xs text-slate-400 mt-1">Certificate Version: v2.1</p>
                        </div>

                        {/* ID Badges */}
                        <div className="flex flex-wrap justify-center gap-4 mt-4">
                            <span className="px-4 py-1 rounded-full border border-amber-200 bg-amber-50 text-amber-800 text-xs font-mono font-medium flex items-center gap-2">
                                <FileSignature className="w-3 h-3" /> ID: HRL-{new Date(timestamp).getFullYear()}-{metadata.catalogNumber || "GEN"}
                            </span>
                            <span className="px-4 py-1 rounded-full border border-amber-200 bg-amber-50 text-amber-800 text-xs font-mono font-medium flex items-center gap-2">
                                <Clock className="w-3 h-3" /> Issued: {new Date(timestamp).toUTCString()}
                            </span>
                        </div>
                    </div>

                    <div className="w-full h-px bg-amber-200/50"></div>

                    {/* SECTION 1: ASSET ID */}
                    <section>
                        <h2 className="flex items-center gap-2 text-lg font-bold text-amber-800 uppercase mb-4">
                            <span className="w-6 h-6 rounded bg-amber-100 flex items-center justify-center text-xs">1</span> Asset Identification (Technical Hash)
                        </h2>
                        <div className="space-y-4 text-sm text-slate-600 leading-relaxed">
                            <p>
                                This document serves as formal confirmation that a unique digital fingerprint (SHA-256 Hash) was generated for the specified audio file. This hash acts as a deterministic cryptographic signature, ensuring the file's integrity and existence at the time of timestamping.
                            </p>

                            <div className="grid grid-cols-1 gap-4">
                                <div className="p-3 border border-slate-200 rounded bg-slate-50">
                                    <div className="text-[10px] uppercase font-bold text-slate-400 mb-1">Filename</div>
                                    <div className="font-mono text-slate-900 font-medium">{metadata.title || "Unknown File"}.wav</div>
                                </div>
                                <div className="p-3 border-2 border-amber-400/30 rounded bg-amber-50/30">
                                    <div className="text-[10px] uppercase font-bold text-slate-400 mb-1">Digital Fingerprint (SHA-256)</div>
                                    <div className="font-mono text-amber-900 font-medium break-all text-xs md:text-sm">{sha256}</div>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* SECTION 3 (Shifted up): METADATA */}
                    <section>
                        <h2 className="flex items-center gap-2 text-lg font-bold text-amber-800 uppercase mb-4">
                            <span className="w-6 h-6 rounded bg-amber-100 flex items-center justify-center text-xs">2</span> Metadata & Creative Attribution
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="p-3 border border-slate-200 rounded">
                                <div className="text-[10px] text-amber-600 font-bold uppercase">Title</div>
                                <div className="font-semibold">{metadata.title}</div>
                            </div>
                            <div className="p-3 border border-slate-200 rounded">
                                <div className="text-[10px] text-amber-600 font-bold uppercase">Artist / Composer</div>
                                <div className="font-semibold">{metadata.artist}</div>
                            </div>
                            <div className="p-3 border border-slate-200 rounded">
                                <div className="text-[10px] text-amber-600 font-bold uppercase">Album</div>
                                <div className="font-semibold">{metadata.album || "Single"}</div>
                            </div>
                            <div className="p-3 border border-slate-200 rounded">
                                <div className="text-[10px] text-amber-600 font-bold uppercase">Label / Publisher</div>
                                <div className="font-semibold">{metadata.publisher || "HardbanRecords Lab"}</div>
                            </div>
                            <div className="p-3 border border-slate-200 rounded">
                                <div className="text-[10px] text-amber-600 font-bold uppercase">Catalog Number</div>
                                <div className="font-semibold">{metadata.catalogNumber || `HRL-CS-${new Date().getFullYear()}-00X`}</div>
                            </div>
                            <div className="p-3 border border-slate-200 rounded">
                                <div className="text-[10px] text-amber-600 font-bold uppercase">ISWC / ISRC</div>
                                <div className="font-semibold">{metadata.isrc || "Pending / Under Registration"}</div>
                            </div>
                        </div>
                    </section>

                    {/* SECTION 4: MUSICAL SPECIFICATIONS */}
                    <section>
                        <h2 className="flex items-center gap-2 text-lg font-bold text-amber-800 uppercase mb-4">
                            <span className="w-6 h-6 rounded bg-amber-100 flex items-center justify-center text-xs">3</span> Musical & Creative Specifications
                        </h2>
                        <div className="space-y-3">
                            <div className="p-3 border border-slate-200 rounded flex justify-between items-center">
                                <div>
                                    <div className="text-[10px] text-amber-600 font-bold uppercase">Tempo / Key</div>
                                    <div className="font-medium">{metadata.bpm ? metadata.bpm.toFixed(0) : '-'} BPM | {metadata.key} {metadata.mode}</div>
                                </div>
                            </div>
                            <div className="p-3 border border-slate-200 rounded">
                                <div className="text-[10px] text-amber-600 font-bold uppercase">Genre</div>
                                <div className="font-medium">{metadata.mainGenre} {join(metadata.additionalGenres) !== 'None' ? `(${join(metadata.additionalGenres)})` : ''}</div>
                            </div>
                            <div className="p-3 border border-slate-200 rounded">
                                <div className="text-[10px] text-amber-600 font-bold uppercase">Mood</div>
                                <div className="font-medium">{join(metadata.moods)}</div>
                            </div>
                        </div>
                    </section>

                    {/* SECTION 6: LEGAL DISCLAIMER */}
                    <section className="bg-amber-50/50 p-6 rounded border border-amber-100">
                        <h2 className="flex items-center gap-2 text-sm font-bold text-amber-800 uppercase mb-2">
                            6. Legal Disclaimer
                        </h2>
                        <p className="text-[11px] text-slate-600 text-justify leading-relaxed">
                            This certificate provides proof that the digital file existed in the state described above on the date specified. It does not, by itself, constitute a government-issued copyright registration, but serves as essential evidentiary support for "prior art" and ownership claims in international jurisdictions under the Berne Convention.
                        </p>
                        <p className="text-[11px] text-amber-700 italic mt-2 font-medium">
                            Verification Note: Any modification to the original file (including metadata changes or re-saving) will result in a different SHA-256 hash, rendering this specific certificate invalid for the altered version.
                        </p>
                    </section>

                    {/* SECTION 7: AUTHENTICATION */}
                    <section>
                        <h2 className="flex items-center gap-2 text-lg font-bold text-amber-800 uppercase mb-4">
                            <span className="w-6 h-6 rounded bg-amber-100 flex items-center justify-center text-xs">7</span> Verification & Authentication
                        </h2>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="md:col-span-2 space-y-4">
                                <div className="p-4 border-2 border-amber-100 rounded-lg bg-white">
                                    <div className="text-[10px] font-bold text-amber-600 uppercase mb-1">Online Verification URL</div>
                                    {ipfsUrl ? (
                                        <a href={ipfsUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-mono text-blue-600 hover:underline break-all block">
                                            {ipfsUrl}
                                        </a>
                                    ) : (
                                        <span className="text-sm text-slate-400 italic">IPFS Link not available in preview</span>
                                    )}
                                </div>
                                <div className="bg-slate-50 p-4 rounded border border-slate-100">
                                    <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">Security Notice</div>
                                    <p className="text-xs text-slate-600">
                                        This certificate contains cryptographic proof of file existence. Always verify the hash matches before accepting authenticity claims.
                                    </p>
                                </div>
                            </div>

                            {/* QR & Seal Placeholder */}
                            <div className="flex flex-col items-center justify-center border border-slate-200 rounded p-4 text-center">
                                <div className="w-24 h-24 bg-slate-900 text-white flex items-center justify-center mb-2">
                                    {/* Abstract Pattern for QR */}
                                    <Hash className="w-12 h-12 opacity-50" />
                                </div>
                                <span className="text-[10px] uppercase font-bold text-slate-400">Scan to Verify</span>
                                <div className="mt-4 pt-4 border-t border-slate-100 w-full">
                                    <div className="text-[10px] font-bold text-amber-600 mb-1">HRL-{new Date(timestamp).getFullYear()}-001</div>
                                </div>
                            </div>
                        </div>
                    </section>
                </div>

                {/* FOOTER */}
                <div className="p-8 md:px-16 border-t border-slate-100 bg-slate-50 flex flex-col md:flex-row justify-between items-end">
                    <div className="text-left mb-4 md:mb-0">
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Certified By:</p>
                        <div className="font-serif text-lg font-bold text-slate-800">HardbanRecords Lab</div>
                        <div className="text-[10px] text-slate-500">Verification Systems</div>
                    </div>

                    <div className="text-right">
                        <div className="mb-2">
                            <span className="font-dancing text-2xl text-blue-900 font-bold italic" style={{ fontFamily: 'Times New Roman, serif' }}>Authorized Signature</span>
                        </div>
                        <div className="w-48 h-px bg-slate-300 mb-1"></div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Digital Authentication Seal</p>
                    </div>
                </div>

                {/* CLOSE BUTTON (Floating) */}
                <div className="absolute top-4 right-4 flex gap-2">
                    <button
                        onClick={() => window.print()}
                        className="p-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 rounded-full transition-colors border border-emerald-200 shadow-sm print:hidden"
                        title="Print / Save as PDF"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    </button>
                    <button
                        onClick={onClose}
                        className="p-2 bg-slate-100 hover:bg-red-50 hover:text-red-500 rounded-full transition-colors text-slate-400 border border-slate-200 print:hidden"
                        title="Close Certificate"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CertificateViewer;
