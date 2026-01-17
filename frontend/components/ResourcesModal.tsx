
import React from 'react';
import { Book, HelpCircle, Server, Code, CreditCard, Map, LayoutDashboard, X, Zap, Shield, Database, Activity } from './icons';
import Button from './Button';

export type ResourceDocType = 'features' | 'pricing' | 'api' | 'roadmap' | 'docs' | 'help' | 'status';

interface ResourcesModalProps {
  type: ResourceDocType | null;
  onClose: () => void;
}

const ResourcesModal: React.FC<ResourcesModalProps> = ({ type, onClose }) => {
  if (!type) return null;

  const renderContent = () => {
    switch (type) {
      case 'features':
        return (
          <div className="space-y-8 animate-fade-in">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-slate-50 dark:bg-slate-900/50 p-6 rounded-xl border border-slate-200 dark:border-slate-800">
                    <div className="w-12 h-12 bg-accent-violet/10 rounded-lg flex items-center justify-center mb-4 text-accent-violet">
                        <Zap className="w-6 h-6" />
                    </div>
                    <h3 className="text-lg font-bold text-light-text dark:text-dark-text mb-2">Batch Processing</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Analyze hundreds of tracks simultaneously. Drag a folder with your discography and let AI catalog everything in minutes.</p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-900/50 p-6 rounded-xl border border-slate-200 dark:border-slate-800">
                    <div className="w-12 h-12 bg-pink-500/10 rounded-lg flex items-center justify-center mb-4 text-pink-500">
                        <Database className="w-6 h-6" />
                    </div>
                    <h3 className="text-lg font-bold text-light-text dark:text-dark-text mb-2">Hybrid Identification</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400">We combine MusicBrainz, AcoustID, ACRCloud, and AudD to flawlessly recognize tracks and fetch official metadata (ISRC).</p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-900/50 p-6 rounded-xl border border-slate-200 dark:border-slate-800">
                    <div className="w-12 h-12 bg-emerald-500/10 rounded-lg flex items-center justify-center mb-4 text-emerald-500">
                        <Activity className="w-6 h-6" />
                    </div>
                    <h3 className="text-lg font-bold text-light-text dark:text-dark-text mb-2">DSP Audio Engineering</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Mathematical audio analysis in browser: BPM, Key Detection, Loudness (LUFS/RMS), True Peak, and Spectrum Analysis.</p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-900/50 p-6 rounded-xl border border-slate-200 dark:border-slate-800">
                    <div className="w-12 h-12 bg-blue-500/10 rounded-lg flex items-center justify-center mb-4 text-blue-500">
                        <Shield className="w-6 h-6" />
                    </div>
                    <h3 className="text-lg font-bold text-light-text dark:text-dark-text mb-2">Copyright & Protection</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Generate Proof-of-Existence certificates (SHA-256) and create DEMO versions with audio watermarks.</p>
                </div>
            </div>
          </div>
        );

      case 'docs':
        return (
          <div className="space-y-8 text-sm text-slate-600 dark:text-slate-300 animate-fade-in leading-relaxed text-justify">
            <div className="border-b border-slate-200 dark:border-slate-800 pb-4 mb-4">
                <h1 className="text-3xl font-black text-slate-900 dark:text-white mb-2">Official Product Documentation</h1>
                <p className="text-xs uppercase font-bold text-slate-400">Version 2.1.0 • Last Updated: January 2026</p>
            </div>

            <section>
                <h3 className="text-xl font-bold text-light-text dark:text-dark-text mb-3">1. Introduction to the Architecture</h3>
                <p className="mb-2">Music Metadata Engine (MME) operates on a "Hybrid Cloud" architecture. Unlike traditional web applications that upload your entire file to a remote server for processing, MME prioritizes client-side execution for speed and privacy.</p>
                <ul className="list-disc pl-5 space-y-1 mt-2">
                    <li><strong>DSP Engine (Browser-based):</strong> Technical audio analysis (BPM, Key, Loudness, Spectral Balance) is calculated directly in your browser using WebAssembly (WASM) and the Web Audio API. Your raw audio data stays on your machine during this phase.</li>
                    <li><strong>AI Inference (Cloud-based):</strong> Only a optimized representation (or a secure, temporary buffer) of the audio is transmitted to Google's Vertex AI (Gemini models) for semantic understanding, genre classification, and descriptive writing.</li>
                </ul>
            </section>

            <section>
                <h3 className="text-xl font-bold text-light-text dark:text-dark-text mb-3">2. Core Workflows</h3>
                
                <h4 className="font-bold text-slate-700 dark:text-slate-200 mt-4 mb-2">2.1. Batch Processing (Pro)</h4>
                <p>The batch processor is designed for high-volume catalog management. It utilizes a sequential queue system to respect API rate limits while ensuring stability.</p>
                <ol className="list-decimal pl-5 space-y-2 mt-2">
                    <li><strong>Import:</strong> Drag & Drop a folder containing MP3, WAV, AIFF, or FLAC files. The system automatically filters non-audio files.</li>
                    <li><strong>Queue:</strong> Files are added to a processing list. You can remove items or reorder priority before starting.</li>
                    <li><strong>Execution:</strong> Click "Analyze". The engine processes files one by one (or in parallel threads for Enterprise plans). <strong>Important:</strong> Do not close the browser tab while the queue is running, as the DSP engine lives in the active window context.</li>
                    <li><strong>Results:</strong> Completed tracks are marked green. Failed tracks (due to corruption or API timeouts) are marked red and can be retried individually.</li>
                </ol>

                <h4 className="font-bold text-slate-700 dark:text-slate-200 mt-4 mb-2">2.2. The Analysis Dashboard</h4>
                <p>Once a track is analyzed, the dashboard presents a unified view of three data sources:</p>
                <ul className="list-disc pl-5 space-y-1 mt-2">
                    <li><strong>Engineering Data:</strong> Hard numbers derived from signal processing (RMS, True Peak, Phase Correlation).</li>
                    <li><strong>AI Classification:</strong> Probabilistic data generated by the LLM (Genre, Mood, Context, Description).</li>
                    <li><strong>Database Match:</strong> Verified data from MusicBrainz/ACRCloud (ISRC, Release Date, Label).</li>
                </ul>
                <p className="mt-2">The "Confidence Score" widget at the top cross-references these three sources to detect anomalies (e.g., if the DSP detects 174 BPM but the AI suggests "Lullaby", the score drops).</p>
            </section>

            <section>
                <h3 className="text-xl font-bold text-light-text dark:text-dark-text mb-3">3. Advanced Features & Modules</h3>

                <div className="space-y-4 mt-2">
                    <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-700">
                        <h5 className="font-bold text-accent-violet mb-1">Fallback DSP Engine</h5>
                        <p className="text-sm">
                            When all external LLMs are unavailable or time out, the engine falls back to a fully deterministic,
                            DSP-only classifier. It uses tempo, RMS, dynamic range, spectral centroid/flatness, harmonic-percussive ratio
                            and duration to approximate genres like House, Techno, Ambient, Hip Hop, Trance, Rock or Classical with
                            transparent, rule-based logic.
                        </p>
                    </div>

                    <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-700">
                        <h5 className="font-bold text-accent-violet mb-1">DeepAudioAnalyzer 2.0</h5>
                        <p className="text-sm">
                            Backend module that extracts 90+ Essentia features (rhythm, loudness, spectral, harmonic, timbral) for every track.
                            These features power the confidence dashboard, DSP fallback, and machine-learning based genre/mood models.
                        </p>
                    </div>

                    <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-700">
                        <h5 className="font-bold text-accent-violet mb-1">Fresh Track Analyzer</h5>
                        <p className="text-sm">
                            High-accuracy path dedicated to unreleased music. It chains DeepAudioAnalyzer 2.0, the 3-model LLM Ensemble
                            and metadata validation to target 95%+ reliability for new masters where no external database entries exist yet.
                        </p>
                    </div>
                </div>
            </section>

            <section>
                <h3 className="text-xl font-bold text-light-text dark:text-dark-text mb-3">4. Data Standards & Exporting</h3>
                <p className="mb-2">MME is compliant with industry standards for metadata embedding.</p>
                
                <h4 className="font-bold text-slate-700 dark:text-slate-200 mt-2 mb-1">ID3v2.3 / ID3v2.4 Mapping</h4>
                <p>When you click "Download File" (Embed), we write tags directly into the file header. Mappings include:</p>
                <div className="overflow-x-auto mt-2">
                    <table className="w-full text-xs text-left font-mono">
                        <thead>
                            <tr className="bg-slate-100 dark:bg-slate-800">
                                <th className="p-2">MME Field</th>
                                <th className="p-2">ID3 Frame</th>
                                <th className="p-2">Description</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr><td className="p-2">Title</td><td className="p-2">TIT2</td><td className="p-2">Track Title</td></tr>
                            <tr><td className="p-2">Artist</td><td className="p-2">TPE1</td><td className="p-2">Lead Performer</td></tr>
                            <tr><td className="p-2">BPM</td><td className="p-2">TBPM</td><td className="p-2">Beats Per Minute</td></tr>
                            <tr><td className="p-2">Key</td><td className="p-2">TKEY</td><td className="p-2">Initial Key</td></tr>
                            <tr><td className="p-2">ISRC</td><td className="p-2">TSRC</td><td className="p-2">Intl. Standard Recording Code</td></tr>
                            <tr><td className="p-2">Moods/Tags</td><td className="p-2">COMM / TXXX</td><td className="p-2">Comments or Custom User Text</td></tr>
                        </tbody>
                    </table>
                </div>

                <h4 className="font-bold text-slate-700 dark:text-slate-200 mt-4 mb-1">CSV Export for Database Import</h4>
                <p>The "Export Batch" feature generates a CSV file optimized for tools like Mp3tag, DISCO.ac, or Excel. It includes all AI reasoning fields and technical metrics not typically supported by standard ID3 tags (e.g., "Spectral Balance Character").</p>
            </section>
          </div>
        );

      case 'help':
        return (
          <div className="space-y-8 animate-fade-in text-justify">
             <div className="border-b border-slate-200 dark:border-slate-800 pb-4 mb-4">
                <h1 className="text-3xl font-black text-slate-900 dark:text-white mb-2">Knowledge Base & Support</h1>
                <p className="text-xs uppercase font-bold text-slate-400">Frequently Asked Questions • Troubleshooting Guide</p>
            </div>

            {/* BILLING & SUBSCRIPTION SECTION */}
            <section>
                <h3 className="text-xl font-bold text-accent-violet mb-4 flex items-center gap-2">
                    <CreditCard className="w-5 h-5" /> Billing & Subscriptions
                </h3>
                
                <details className="group mb-4 bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                    <summary className="font-bold text-light-text dark:text-dark-text cursor-pointer flex justify-between items-center">
                        Who handles my payments? (Merchant of Record)
                        <span className="group-open:rotate-180 transition-transform">▼</span>
                    </summary>
                    <div className="mt-3 text-sm text-slate-600 dark:text-slate-300 leading-relaxed border-t border-slate-200 dark:border-slate-700 pt-3">
                        <p>We partner with <strong>Lemon Squeezy</strong>, a trusted global Merchant of Record. This means:</p>
                        <ul className="list-disc pl-5 mt-2 space-y-1">
                            <li>Your invoice will come from Lemon Squeezy.</li>
                            <li>They handle all global tax compliance (VAT, GST, Sales Tax).</li>
                            <li>They securely process your credit card or PayPal data; we never see your full financial details.</li>
                        </ul>
                    </div>
                </details>

                <details className="group mb-4 bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                    <summary className="font-bold text-light-text dark:text-dark-text cursor-pointer flex justify-between items-center">
                        How do I cancel or upgrade my plan?
                        <span className="group-open:rotate-180 transition-transform">▼</span>
                    </summary>
                    <div className="mt-3 text-sm text-slate-600 dark:text-slate-300 leading-relaxed border-t border-slate-200 dark:border-slate-700 pt-3">
                        <p>You have full control over your subscription via the Customer Portal.</p>
                        <ol className="list-decimal pl-5 mt-2 space-y-1">
                            <li>Look for an email from Lemon Squeezy with the subject "Your receipt...". It contains a direct link to manage your subscription.</li>
                            <li>Alternatively, go to Settings in our app and click "Manage Billing".</li>
                        </ol>
                        <p className="mt-2">Cancellation is effective at the end of the current billing period. Upgrades are prorated immediately.</p>
                    </div>
                </details>

                <details className="group mb-4 bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                    <summary className="font-bold text-light-text dark:text-dark-text cursor-pointer flex justify-between items-center">
                        Refund Policy
                        <span className="group-open:rotate-180 transition-transform">▼</span>
                    </summary>
                    <div className="mt-3 text-sm text-slate-600 dark:text-slate-300 leading-relaxed border-t border-slate-200 dark:border-slate-700 pt-3">
                        <p>We offer a 14-day money-back guarantee for first-time purchases of any plan, provided you have used less than 20% of your allocated analysis credits. Contact support@musicmetadata.ai or use the request refund button in the Lemon Squeezy portal.</p>
                    </div>
                </details>
            </section>

            {/* TECHNICAL SECTION */}
            <section className="mt-8">
                <h3 className="text-xl font-bold text-blue-500 mb-4 flex items-center gap-2">
                    <Server className="w-5 h-5" /> Technical & Analysis
                </h3>

                <details className="group mb-4 bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                    <summary className="font-bold text-light-text dark:text-dark-text cursor-pointer flex justify-between items-center">
                        Why is the analysis sometimes slow?
                        <span className="group-open:rotate-180 transition-transform">▼</span>
                    </summary>
                    <div className="mt-3 text-sm text-slate-600 dark:text-slate-300 leading-relaxed border-t border-slate-200 dark:border-slate-700 pt-3">
                        <p>Our engine performs a complex sequence of operations:</p>
                        <ul className="list-disc pl-5 mt-2 space-y-1">
                            <li><strong>Local Decoding:</strong> Large files (WAV/FLAC) take time to decode in the browser for DSP analysis. This depends on your CPU speed.</li>
                            <li><strong>Upload Latency:</strong> Audio snippets must be securely uploaded to the AI inference endpoint. Slow internet connections will affect this.</li>
                            <li><strong>"Thinking" Time:</strong> Generative AI models (Gemini) generate tokens sequentially. A detailed description takes longer to write than a simple genre tag.</li>
                        </ul>
                    </div>
                </details>

                <details className="group mb-4 bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                    <summary className="font-bold text-light-text dark:text-dark-text cursor-pointer flex justify-between items-center">
                        The AI genre was wrong. How do I fix it?
                        <span className="group-open:rotate-180 transition-transform">▼</span>
                    </summary>
                    <div className="mt-3 text-sm text-slate-600 dark:text-slate-300 leading-relaxed border-t border-slate-200 dark:border-slate-700 pt-3">
                        <p>AI is probabilistic, not deterministic. It interprets audio based on training data.</p>
                        <p className="mt-2"><strong>Solution:</strong> Use the "Refine" (Sparkles icon) button next to the Genre field. You can give the AI a hint, e.g., "This is actually a sub-genre of House, focus on the bassline". The system will re-evaluate based on your feedback.</p>
                    </div>
                </details>

                <details className="group mb-4 bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                    <summary className="font-bold text-light-text dark:text-dark-text cursor-pointer flex justify-between items-center">
                        Can I close the tab during Batch Processing?
                        <span className="group-open:rotate-180 transition-transform">▼</span>
                    </summary>
                    <div className="mt-3 text-sm text-slate-600 dark:text-slate-300 leading-relaxed border-t border-slate-200 dark:border-slate-700 pt-3">
                        <p><strong>No.</strong> The core of our privacy-first architecture is that the "Controller" logic runs in your browser. If you close the tab, the queue stops immediately. However, you can switch tabs or minimize the window.</p>
                    </div>
                </details>
            </section>

            {/* LEGAL & USAGE SECTION */}
            <section className="mt-8">
                <h3 className="text-xl font-bold text-emerald-500 mb-4 flex items-center gap-2">
                    <Shield className="w-5 h-5" /> Usage & Rights
                </h3>

                <details className="group mb-4 bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                    <summary className="font-bold text-light-text dark:text-dark-text cursor-pointer flex justify-between items-center">
                        Who owns the generated metadata and descriptions?
                        <span className="group-open:rotate-180 transition-transform">▼</span>
                    </summary>
                    <div className="mt-3 text-sm text-slate-600 dark:text-slate-300 leading-relaxed border-t border-slate-200 dark:border-slate-700 pt-3">
                        <p><strong>You do.</strong> We assign all rights to the output (text, tags, generated images) to you. You are free to use them commercially on Spotify, Beatport, or for Sync Licensing without attribution to us.</p>
                    </div>
                </details>

                <details className="group mb-4 bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                    <summary className="font-bold text-light-text dark:text-dark-text cursor-pointer flex justify-between items-center">
                        Does the "Copyright Certificate" hold up in court?
                        <span className="group-open:rotate-180 transition-transform">▼</span>
                    </summary>
                    <div className="mt-3 text-sm text-slate-600 dark:text-slate-300 leading-relaxed border-t border-slate-200 dark:border-slate-700 pt-3">
                        <p>The certificate provides a cryptographic timestamp (Proof of Existence) linking your file's unique hash to a specific date. While it is strong evidence that you possessed the file at that time, it is not a replacement for formal government copyright registration (e.g., US Copyright Office). It serves as a strong supplementary evidence layer.</p>
                    </div>
                </details>
            </section>

            <div className="mt-8 p-6 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800 text-center">
                <h3 className="font-bold text-blue-800 dark:text-blue-300 mb-2">Still need help?</h3>
                <p className="text-sm text-blue-600 dark:text-blue-400 mb-4">Our support team operates Mon-Fri, 9:00 - 17:00 CET.</p>
                <div className="flex justify-center gap-4">
                    <a href="mailto:support@musicmetadata.ai" className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-lg">
                        Email Support
                    </a>
                    <a href="https://hardbanrecordslab.lemonsqueezy.com/billing" target="_blank" rel="noreferrer" className="inline-flex items-center justify-center px-6 py-3 border border-slate-300 dark:border-slate-600 text-sm font-medium rounded-md text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                        Billing Portal (Lemon Squeezy)
                    </a>
                </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const titles: Record<ResourceDocType, string> = {
      features: 'Features & Capabilities',
      pricing: 'Pricing',
      api: 'API for Developers',
      roadmap: 'Development Roadmap',
      docs: 'Documentation',
      help: 'Help Center',
      status: 'System Status'
  };

  const icons: Record<ResourceDocType, React.ReactNode> = {
      features: <LayoutDashboard className="w-6 h-6 text-white" />,
      pricing: <CreditCard className="w-6 h-6 text-white" />,
      api: <Code className="w-6 h-6 text-white" />,
      roadmap: <Map className="w-6 h-6 text-white" />,
      docs: <Book className="w-6 h-6 text-white" />,
      help: <HelpCircle className="w-6 h-6 text-white" />,
      status: <Server className="w-6 h-6 text-white" />
  };

  return (
    <div 
      className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4 animate-fade-in"
      onClick={onClose}
    >
      <div 
        className="bg-light-card dark:bg-dark-card rounded-2xl shadow-xl w-full max-w-4xl border border-slate-200 dark:border-slate-800 relative overflow-hidden flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
             <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-lg flex items-center justify-center shrink-0">
                    {icons[type]}
                </div>
                <div>
                    <h2 className="text-2xl font-bold text-light-text dark:text-dark-text tracking-tight">
                        {titles[type]}
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Music Metadata Engine Resources</p>
                </div>
            </div>
            <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors" aria-label="Close modal">
                <X className="w-6 h-6 text-slate-500" />
            </button>
        </div>
        
        {/* Content */}
        <div className="p-8 overflow-y-auto custom-scrollbar bg-white dark:bg-dark-card">
            {renderContent()}
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-200 dark:border-slate-800 flex justify-end">
            <Button onClick={onClose} variant="secondary">
                Close
            </Button>
        </div>
      </div>
    </div>
  );
};

export default ResourcesModal;
