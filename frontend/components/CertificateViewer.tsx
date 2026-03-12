import React, { useRef } from 'react';
import { Metadata } from '../types';
import { Shield, Globe, Clock, FileSignature, Music, Hash, ShieldCheck, X, Download } from './icons';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

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
    const certificateRef = useRef<HTMLDivElement>(null);

    // Helper to join arrays
    const join = (arr?: string[]) => arr && arr.length ? arr.join(', ') : 'None';

    // Parse duration
    const formatDuration = (seconds?: number) => {
        if (!seconds) return '0:00';
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    // Public verification URL
    const verifyUrl = `https://metadata.hardbanrecordslab.online/verify/${sha256}`;
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(verifyUrl)}`;

    // PDF Export Handler
    const handleDownloadPDF = async () => {
        if (!certificateRef.current) return;

        try {
            const canvas = await html2canvas(certificateRef.current, {
                scale: 3, // Higher scale for print quality
                useCORS: true,
                logging: false,
                backgroundColor: '#ffffff'
            });

            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: 'a4'
            });

            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            const imgWidth = canvas.width;
            const imgHeight = canvas.height;
            const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
            const imgX = (pdfWidth - imgWidth * ratio) / 2;
            const imgY = 0;

            pdf.addImage(imgData, 'PNG', imgX, imgY, imgWidth * ratio, imgHeight * ratio);
            pdf.save(`Certificate_${metadata.title || 'Track'}_Fingerprint.pdf`);
        } catch (error) {
            console.error('PDF generation failed:', error);
            alert('Failed to generate PDF. Please try again.');
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/95 backdrop-blur-xl p-4 md:p-10 animate-fade-in overflow-y-auto custom-scrollbar">
            {/* Certificate A4 Canvas */}
            <div
                ref={certificateRef}
                className="relative w-full max-w-[850px] bg-white text-slate-900 shadow-[0_0_100px_rgba(0,0,0,0.5)] my-auto min-h-[1100px] flex flex-col font-serif"
                style={{ aspectRatio: '1/1.414' }}
            >
                {/* Institutional Borders */}
                <div className="absolute inset-4 border-[6px] border-amber-600/20 pointer-events-none"></div>
                <div className="absolute inset-6 border-[1px] border-amber-600/40 pointer-events-none"></div>
                <div className="absolute inset-8 border-[2px] border-amber-600/10 pointer-events-none"></div>

                {/* Corners Decorations */}
                <div className="absolute top-8 left-8 w-12 h-12 border-t-4 border-l-4 border-amber-700/60 z-10"></div>
                <div className="absolute top-8 right-8 w-12 h-12 border-t-4 border-r-4 border-amber-700/60 z-10"></div>
                <div className="absolute bottom-8 left-8 w-12 h-12 border-b-4 border-l-4 border-amber-700/60 z-10"></div>
                <div className="absolute bottom-8 right-8 w-12 h-12 border-b-4 border-r-4 border-amber-700/60 z-10"></div>

                {/* Main Content Area */}
                <div className="p-16 md:p-24 flex-1 flex flex-col gap-12 relative z-0">

                    {/* Watermark */}
                    <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] pointer-events-none select-none z-[-1] overflow-hidden">
                        <div className="rotate-[-35deg] text-[120px] font-black text-slate-950 whitespace-nowrap">
                            HARDBAN RECORDS LAB • HARDBAN RECORDS LAB • HARDBAN RECORDS LAB
                        </div>
                    </div>

                    {/* HEADER */}
                    <div className="text-center space-y-6">
                        <div className="flex justify-center mb-4">
                            <div className="relative">
                                <ShieldCheck className="w-20 h-20 text-amber-600" strokeWidth={1} />
                                <div className="absolute inset-0 animate-pulse-slow opacity-20">
                                    <ShieldCheck className="w-20 h-20 text-amber-600" strokeWidth={1} />
                                </div>
                            </div>
                        </div>
                        <div>
                            <h1 className="text-4xl md:text-5xl font-bold text-amber-800 tracking-tight uppercase mb-2">Authenticity Certificate</h1>
                            <p className="text-sm font-semibold tracking-[0.4em] text-slate-400 uppercase">Cryptographic Asset Verification & Metadata Record</p>
                        </div>

                        <div className="flex flex-wrap justify-center gap-6 pt-6">
                            <div className="text-center">
                                <div className="text-[10px] uppercase font-bold text-amber-600/60 mb-1">Serial Number</div>
                                <div className="font-mono text-xs font-bold text-slate-800 bg-amber-50 px-3 py-1 border border-amber-100 rounded">HRL-{new Date(timestamp).getFullYear()}-{metadata.catalogNumber || "UNTITLED"}</div>
                            </div>
                            <div className="text-center">
                                <div className="text-[10px] uppercase font-bold text-amber-600/60 mb-1">Issued On</div>
                                <div className="font-mono text-xs font-bold text-slate-800 bg-amber-50 px-3 py-1 border border-amber-100 rounded">{new Date(timestamp).toUTCString()}</div>
                            </div>
                        </div>
                    </div>

                    <div className="w-full h-px bg-gradient-to-r from-transparent via-amber-200 to-transparent"></div>

                    {/* SECTION 1: TECHNICAL FINGERPRINT */}
                    <section className="space-y-4">
                        <h2 className="flex items-center gap-3 text-lg font-bold text-amber-900 uppercase">
                            <span className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-xs text-amber-800 border border-amber-200">01</span>
                            HardBand Records Authenticity DNA
                        </h2>
                        <div className="bg-slate-50 p-6 rounded-lg border border-slate-100 shadow-inner">
                            <p className="text-xs text-slate-500 mb-3 leading-relaxed">
                                This immutable cryptographic hash (SHA-256) serves as a deterministic signature of the original audio master. Any alteration to the file will invalidate this certificate.
                            </p>
                            <div className="font-mono text-amber-900 font-bold break-all text-xs md:text-sm bg-white p-4 border border-amber-200/50 rounded shadow-sm">
                                {sha256 || 'PROCESSED_DATA_LAYER_REQUIRED'}
                            </div>
                        </div>
                    </section>

                    {/* SECTION 2: CREATIVE ATTRIBUTION */}
                    <section className="space-y-4">
                        <h2 className="flex items-center gap-3 text-lg font-bold text-amber-900 uppercase">
                            <span className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-xs text-amber-800 border border-amber-200">02</span>
                            Creative & Intellectual Attribution
                        </h2>
                        <div className="grid grid-cols-2 gap-x-12 gap-y-6 px-4">
                            <div>
                                <div className="text-[10px] text-amber-600 font-black uppercase tracking-widest mb-1">Asset Title</div>
                                <div className="text-lg font-bold text-slate-900">{metadata.title || "Unknown Asset"}</div>
                            </div>
                            <div>
                                <div className="text-[10px] text-amber-600 font-black uppercase tracking-widest mb-1">Principal Artist</div>
                                <div className="text-lg font-bold text-slate-900">{metadata.artist || "Anonymous"}</div>
                            </div>
                            <div>
                                <div className="text-[10px] text-amber-600 font-black uppercase tracking-widest mb-1">Publisher / Rights Holder</div>
                                <div className="text-base font-medium text-slate-700">{metadata.publisher || "HardbanRecords Lab"}</div>
                            </div>
                            <div>
                                <div className="text-[10px] text-amber-600 font-black uppercase tracking-widest mb-1">Registration ID (ISRC/ISWC)</div>
                                <div className="text-base font-mono font-bold text-slate-700">{metadata.isrc || "PENDING"}</div>
                            </div>
                        </div>
                    </section>

                    {/* SECTION 3: SONIC DNA */}
                    <section className="space-y-4">
                        <h2 className="flex items-center gap-3 text-lg font-bold text-amber-900 uppercase">
                            <span className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-xs text-amber-800 border border-amber-200">03</span>
                            Musical & Sonic Specifications
                        </h2>
                        <div className="grid grid-cols-3 gap-4 bg-amber-50/30 p-4 rounded border border-amber-100">
                            <div className="text-center">
                                <div className="text-[9px] text-slate-400 font-bold uppercase mb-1">Tempo</div>
                                <div className="text-sm font-bold">{metadata.bpm ? Math.round(metadata.bpm) : '--'} BPM</div>
                            </div>
                            <div className="text-center border-l border-amber-100">
                                <div className="text-[9px] text-slate-400 font-bold uppercase mb-1">Key / Mode</div>
                                <div className="text-sm font-bold">{metadata.key} {metadata.mode}</div>
                            </div>
                            <div className="text-center border-l border-amber-100">
                                <div className="text-[9px] text-slate-400 font-bold uppercase mb-1">Duration</div>
                                <div className="text-sm font-bold">{formatDuration(metadata.duration)}</div>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-3 bg-white border border-slate-100 rounded">
                                <div className="text-[9px] text-amber-600 font-bold uppercase mb-1">Main Genre</div>
                                <div className="text-xs font-medium">{metadata.mainGenre}</div>
                            </div>
                            <div className="p-3 bg-white border border-slate-100 rounded">
                                <div className="text-[9px] text-amber-600 font-bold uppercase mb-1">Vocal Content</div>
                                <div className="text-xs font-medium">{metadata.vocalStyle?.gender && metadata.vocalStyle.gender !== 'none' ? `Present (${metadata.vocalStyle.gender})` : 'Instrumental'}</div>
                            </div>
                        </div>
                    </section>

                    {/* LEGAL DISCLAIMER */}
                    <section className="mt-auto border-t border-slate-100 pt-8">
                        <div className="bg-slate-50 p-6 rounded border border-slate-200/50">
                            <div className="flex items-center gap-2 mb-3">
                                <Shield className="w-4 h-4 text-amber-700" />
                                <span className="text-xs font-bold text-amber-900 uppercase">Legal Declaration & Copyright Evidence</span>
                            </div>
                            <p className="text-[10px] text-slate-600 text-justify leading-relaxed italic">
                                This document provides admissible evidence of track existence and state under the Berne Convention for the Protection of Literary and Artistic Works. It serves as essential technical documentation for copyright claims, sync licensing validation, and IP protection. HardbanRecords Lab maintains the timestamped record in its secure digital vault.
                            </p>
                        </div>
                    </section>

                    {/* AUTHENTICATION FOOTER */}
                    <section className="grid grid-cols-3 items-end gap-8">
                        <div className="space-y-2">
                            <div className="text-[10px] text-amber-600 font-black uppercase tracking-widest">Authorized By</div>
                            <div className="font-serif text-xl font-bold text-slate-800">HardbanRecords</div>
                            <div className="text-[10px] text-slate-400 font-medium italic">Standard Issue: 0.50 USD</div>
                        </div>

                        <div className="flex flex-col items-center justify-center p-4 border border-amber-100 bg-amber-50/20 rounded">
                            <img
                                src={qrCodeUrl}
                                alt="Verification QR"
                                className="w-24 h-24 mix-blend-multiply opacity-90"
                            />
                            <div className="text-[8px] font-bold text-slate-400 uppercase mt-2">Scan to Verify Publicly</div>
                        </div>

                        <div className="text-right space-y-4">
                            <div className="inline-block border-b-2 border-slate-300 w-full pb-1">
                                <span className="font-dancing text-2xl text-blue-900 font-bold italic" style={{ fontFamily: 'Times New Roman, serif' }}>Verification Seal</span>
                            </div>
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter italic">Valid Only with Original SHA-256 Hash</div>
                        </div>
                    </section>
                </div>

                {/* CLOSE BUTTON (Floating, won't be in PDF) */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-2 bg-slate-950 text-white rounded-full transition-transform hover:scale-110 z-[101]"
                    title="Close"
                    data-html2canvas-ignore="true"
                >
                    <X className="w-5 h-5" />
                </button>

                {/* DOWNLOAD PDF BUTTON (Floating, won't be in PDF) */}
                <button
                    onClick={handleDownloadPDF}
                    className="absolute top-4 right-16 px-4 py-2 bg-emerald-600 text-white font-bold text-xs rounded-full transition-all hover:bg-emerald-700 shadow-lg z-[101] flex items-center gap-2"
                    data-html2canvas-ignore="true"
                >
                    <Download className="w-4 h-4" /> Download Certificate (PDF)
                </button>
            </div>
        </div>
    );
};

export default CertificateViewer;
