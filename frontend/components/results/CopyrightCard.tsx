import React, { useState, useRef, useEffect } from 'react';
import { Metadata } from '../../types';
import Card from './Card';
import Button from '../Button';
import { Shield, Lock, FileSignature, Stamp, Upload, Eye } from '../icons';
import { calculateFileHash, pinCertificateToIPFS } from '../../services/copyrightService';
import CertificateViewer from '../CertificateViewer';

interface CopyrightCardProps {
    metadata: Metadata;
    file: File | null;
    onUpdateFile: (file: File) => void;
    showToast: (message: string, type: 'success' | 'error' | 'info') => void;
    jobId?: string;
}

const CopyrightCard: React.FC<CopyrightCardProps> = ({ metadata, file, onUpdateFile, showToast, jobId }) => {
    const [hash, setHash] = useState<string | null>(null);
    const [isHashing, setIsHashing] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [fileError, setFileError] = useState<string | null>(null);
    const [ipfsLink, setIpfsLink] = useState<string | null>(null);
    const [isViewerOpen, setIsViewerOpen] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Reset state when file changes or use pre-calculated hash
    useEffect(() => {
        if (metadata.sha256) {
            setHash(metadata.sha256);
        } else {
            setHash(null);
        }
        setIpfsLink(null);
        setIsHashing(false);
        setFileError(null);
    }, [file, metadata.sha256]);

    const handleCalculateHash = async () => {
        if (!file) {
            setFileError("Source file reference missing.");
            return;
        }
        setIsHashing(true);
        setFileError(null);
        try {
            if (file.size === 0) throw new Error("File appears to be empty or inaccessible.");

            const h = await calculateFileHash(file);
            setHash(h);
            showToast("Digital fingerprint calculated!", 'success');
        } catch (e: any) {
            console.error("Hash calculation failed:", e);
            if (e.name === 'NotReadableError' || e.message.includes('read')) {
                setFileError("Browser lost access to the file. Please re-select it using the button below.");
            } else {
                setFileError(e.message || "Error calculating file hash.");
            }
        } finally {
            setIsHashing(false);
        }
    };

    const handleFileRecovery = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newFile = e.target.files?.[0];
        if (newFile) {
            setFileError(null);
            onUpdateFile(newFile);
            showToast("File reference restored. Try calculating hash again.", 'info');
        }
    };

    const handleViewCertificate = () => {
        if (!hash) return;
        setIsViewerOpen(true);
    };

    const handleUploadIPFS = async () => {
        if (!hash || !file) return;
        setIsUploading(true);
        try {
            showToast("Generating premium cert and pinning JSON to IPFS...", 'info');

            // This now calls the backend which uploads JSON to Pinata
            const { ipfs_url } = await pinCertificateToIPFS(metadata, hash, file.name, jobId);
            setIpfsLink(ipfs_url);
            showToast("Successfully pinned to IPFS!", 'success');

        } catch (e: any) {
            console.error("IPFS pinning failed:", e);
            showToast(`IPFS pinning failed: ${e.message}`, 'error');
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <Card className="border-l-4 border-l-emerald-500">
            <div className="flex items-center gap-3 border-b border-slate-200 dark:border-slate-800 pb-4 mb-6">
                <div className="w-10 h-10 flex items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-green-600 text-white shadow-md shadow-emerald-500/20">
                    <Shield className="w-6 h-6" />
                </div>
                <div>
                    <h3 className="text-lg font-bold text-light-text dark:text-dark-text">Rights Protection (Copyright)</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Secure your tracks against theft.</p>
                </div>
            </div>

            <div className="space-y-6">
                {/* Hash & Certificate Section */}
                <div className="bg-slate-50 dark:bg-slate-900/30 p-5 rounded-xl border border-slate-200 dark:border-slate-800">
                    <div className="flex items-center gap-2 mb-4 text-emerald-600 dark:text-emerald-400">
                        <FileSignature className="w-5 h-5" />
                        <h4 className="font-bold text-sm uppercase tracking-wide">Digital Asset Protection</h4>
                    </div>

                    <div className="space-y-4">
                        {/* STEP 1: HASH */}
                        <div className="flex flex-col gap-2">
                            <div className="flex justify-between items-center mb-1">
                                <span className="text-xs font-bold text-slate-500 uppercase">Step 1: Cryptographic Fingerprint</span>
                                {hash && <span className="text-[10px] bg-emerald-500/20 text-emerald-500 px-2 py-0.5 rounded-full font-bold">VERIFIED</span>}
                            </div>

                            {!hash ? (
                                <div className="space-y-3">
                                    <Button onClick={handleCalculateHash} disabled={isHashing || !file} size="sm" variant="secondary" className="w-full justify-center">
                                        {isHashing ? (
                                            <>
                                                <div className="w-4 h-4 border-2 border-slate-500 border-t-transparent rounded-full animate-spin mr-2" /> Calculating...
                                            </>
                                        ) : (
                                            <>
                                                <Lock className="w-4 h-4 mr-2" /> Generate SHA-256 Fingerprint
                                            </>
                                        )}
                                    </Button>

                                    {fileError && (
                                        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg animate-shake">
                                            <p className="text-[10px] text-red-600 dark:text-red-400 font-medium leading-relaxed">
                                                {fileError}
                                            </p>
                                            <input
                                                type="file"
                                                ref={fileInputRef}
                                                onChange={handleFileRecovery}
                                                className="hidden"
                                                accept="audio/*"
                                            />
                                            <Button
                                                onClick={() => fileInputRef.current?.click()}
                                                variant="secondary"
                                                size="sm"
                                                className="w-full mt-2 text-[9px] h-7 border-red-200 text-red-600 hover:bg-red-50"
                                            >
                                                Fix: Re-select File
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="bg-slate-100 dark:bg-slate-800 p-3 rounded-lg text-[10px] font-mono break-all text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 animate-fade-in shadow-inner">
                                    {hash}
                                </div>
                            )}
                        </div>

                        {/* STEP 2: ACTIONS */}
                        <div className="flex flex-col gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                            <span className="text-xs font-bold text-slate-500 uppercase mb-1">Step 2: Certificate Actions</span>
                            <div className="flex gap-2">
                                <Button
                                    onClick={handleViewCertificate}
                                    disabled={!hash}
                                    size="sm"
                                    variant="primary"
                                    className={`flex-1 justify-center ${hash ? 'bg-emerald-600 hover:bg-emerald-700' : 'opacity-50'} text-white border-none`}
                                >
                                    <Stamp className="w-4 h-4 mr-2" /> View Certificate
                                </Button>

                                <Button
                                    onClick={handleUploadIPFS}
                                    disabled={!hash || isUploading}
                                    size="sm"
                                    variant="secondary"
                                    className={`flex-1 justify-center border-emerald-600 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 ${!hash ? 'opacity-50' : ''}`}
                                >
                                    {isUploading ? (
                                        <div className="w-4 h-4 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                                    ) : (
                                        <><Upload className="w-4 h-4 mr-2" /> Protect (IPFS)</>
                                    )}
                                </Button>
                            </div>
                            {!hash && (
                                <p className="text-[10px] text-slate-400 italic text-center">Complete Step 1 to enable certificate generation.</p>
                            )}
                            {ipfsLink && (
                                <div className="mt-4 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg animate-fade-in">
                                    <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold uppercase mb-1 flex items-center gap-2">
                                        <Shield className="w-3 h-3" /> Blockchain-Anchored Proof Live
                                    </p>
                                    <a
                                        href={ipfsLink}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-[10px] text-emerald-500 underline break-all hover:text-emerald-400"
                                    >
                                        {ipfsLink}
                                    </a>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {isViewerOpen && hash && (
                <CertificateViewer
                    metadata={metadata}
                    sha256={hash}
                    timestamp={new Date().toISOString()} // Live preview timestamp
                    ipfsUrl={ipfsLink || undefined}
                    onClose={() => setIsViewerOpen(false)}
                />
            )}
        </Card>
    );
};

export default CopyrightCard;
