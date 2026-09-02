
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
                                <h3 className="text-lg font-bold text-light-text dark:text-dark-text mb-2">Analysis Dashboard</h3>
                                <p className="text-sm text-slate-600 dark:text-slate-400">Single-track professional analysis with DSP features, AI classification and export to industry formats.</p>
                            </div>
                            <div className="bg-slate-50 dark:bg-slate-900/50 p-6 rounded-xl border border-slate-200 dark:border-slate-800">
                                <div className="w-12 h-12 bg-pink-500/10 rounded-lg flex items-center justify-center mb-4 text-pink-500">
                                    <Database className="w-6 h-6" />
                                </div>
                                <h3 className="text-lg font-bold text-light-text dark:text-dark-text mb-2">Metadata Enrichment</h3>
                                <p className="text-sm text-slate-600 dark:text-slate-400">Enrich with public sources (Spotify, Last.fm, MusicBrainz) where available to complement AI and DSP results.</p>
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
                                <p className="text-sm text-slate-600 dark:text-slate-400">Generate Proof-of-Existence certificates (SHA-256) with premium PDF and QR verification.</p>
                            </div>
                        </div>
                    </div>
                );

            case 'docs':
                return (
                    <div className="space-y-6 text-sm text-slate-600 dark:text-slate-300 animate-fade-in leading-relaxed">
                        <div className="border-b border-slate-200 dark:border-slate-800 pb-4 mb-2">
                            <h1 className="text-3xl font-black text-slate-900 dark:text-white mb-2">Documentation</h1>
                            <p className="text-xs uppercase font-bold text-slate-400">The full set — business, architecture, user guide, legal, operations, API — lives in the <code>docs/</code> folder of the repository.</p>
                        </div>

                        <section>
                            <h3 className="text-lg font-bold text-light-text dark:text-dark-text mb-2">How an analysis works</h3>
                            <ol className="list-decimal pl-5 space-y-1">
                                <li>Your browser runs an instant DSP preview (BPM, key, loudness) with Essentia.js / WebAssembly.</li>
                                <li>The file is uploaded; the server runs the full DSP pass (Essentia + Librosa) and computes a SHA-256 Authenticity DNA of the decoded audio.</li>
                                <li>A consensus ensemble of language models (Groq, Google Gemini, OpenRouter) classifies genre, mood, instrumentation and vocal style, and writes the description. Several models must agree; each tag carries a confidence score.</li>
                                <li>Identification runs against ACRCloud / AcoustID / MusicBrainz; enrichment against Spotify / Last.fm / Discogs.</li>
                                <li>The upload is discarded once the analysis completes.</li>
                            </ol>
                        </section>

                        <section>
                            <h3 className="text-lg font-bold text-light-text dark:text-dark-text mb-2">Reading the results</h3>
                            <p>Results are grouped into cards — Track Identity, Sonic Analysis, Classification &amp; Style, Structure, Identification, External Data, Marketing, Commercial/Legal, Copyright, Visuals, and a Validation Report. The confidence widget cross-checks DSP vs AI vs database data and flags contradictions (e.g. 174 BPM measured but "Lullaby" suggested).</p>
                            <p className="mt-1"><strong>Every AI tag is a suggestion you can override.</strong></p>
                        </section>

                        <section>
                            <h3 className="text-lg font-bold text-light-text dark:text-dark-text mb-2">Exports</h3>
                            <ul className="list-disc pl-5 space-y-1">
                                <li><strong>MP3Tag CSV</strong> — bulk import; includes AI fields standard tags don't carry.</li>
                                <li><strong>JSON</strong> — the full structure.</li>
                                <li><strong>DDEX ERN 4.3</strong> — delivery to DSPs via a distributor.</li>
                                <li><strong>CWR 2.1</strong> — PRO / CMO work registration.</li>
                                <li><strong>Write-back</strong> — ID3 (TIT2 / TPE1 / TBPM / TKEY / TSRC / COMM…) or Vorbis tags straight into the file.</li>
                            </ul>
                        </section>

                        <section>
                            <h3 className="text-lg font-bold text-light-text dark:text-dark-text mb-2">Batch &amp; certificates</h3>
                            <p>The Batch Processor queues many files (1 credit each) — keep the tab open while it runs. Any analysed track can get a Certificate of Authenticity (PDF) pinned to IPFS with a public <code>/verify/&lt;id&gt;</code> page.</p>
                        </section>

                        <section>
                            <h3 className="text-lg font-bold text-light-text dark:text-dark-text mb-2">Programmatic access</h3>
                            <p>See the <strong>API</strong> tab — submit audio with an <code>X-API-Key</code> from Settings → Security, poll for the result, export. Full reference in <code>docs/API.md</code> and at <code>/api/docs</code>.</p>
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
                                <CreditCard className="w-5 h-5" /> Billing & Credits
                            </h3>

                            <details className="group mb-4 bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                                <summary className="font-bold text-light-text dark:text-dark-text cursor-pointer flex justify-between items-center">
                                    How does pricing work?
                                    <span className="group-open:rotate-180 transition-transform">▼</span>
                                </summary>
                                <div className="mt-3 text-sm text-slate-600 dark:text-slate-300 leading-relaxed border-t border-slate-200 dark:border-slate-700 pt-3">
                                    <p>There is no subscription. You buy <strong>one-time credit packs</strong> and <strong>1 credit = 1 full analysis</strong>. Exporting the results of an analysis you already ran is free. New accounts start with a few free credits, and promo / referral codes add more.</p>
                                    <ul className="list-disc pl-5 mt-2 space-y-1">
                                        <li>Starter — 10 credits — $9</li>
                                        <li>Producer — 50 credits — $35</li>
                                        <li>Label — 150 credits — $89</li>
                                        <li>Studio — 400 credits — $199</li>
                                    </ul>
                                </div>
                            </details>

                            <details className="group mb-4 bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                                <summary className="font-bold text-light-text dark:text-dark-text cursor-pointer flex justify-between items-center">
                                    Who handles my payment?
                                    <span className="group-open:rotate-180 transition-transform">▼</span>
                                </summary>
                                <div className="mt-3 text-sm text-slate-600 dark:text-slate-300 leading-relaxed border-t border-slate-200 dark:border-slate-700 pt-3">
                                    <p>Payments are processed by <strong>Stripe</strong>. HardbanRecords Lab is the seller and issues the invoice. We never see your full card details — Stripe handles them on its own secure checkout pages.</p>
                                    <p className="mt-2">To buy credits: <strong>Settings → Buy credits</strong>. Credits are added automatically as soon as the payment confirms.</p>
                                </div>
                            </details>

                            <details className="group mb-4 bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                                <summary className="font-bold text-light-text dark:text-dark-text cursor-pointer flex justify-between items-center">
                                    Refund Policy
                                    <span className="group-open:rotate-180 transition-transform">▼</span>
                                </summary>
                                <div className="mt-3 text-sm text-slate-600 dark:text-slate-300 leading-relaxed border-t border-slate-200 dark:border-slate-700 pt-3">
                                    <p>For billing and subscription inquiries, contact us at contact@hardbanrecordslab.online. Refunds follow applicable consumer law in your jurisdiction.</p>
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
                                    Can I close the tab during analysis?
                                    <span className="group-open:rotate-180 transition-transform">▼</span>
                                </summary>
                                <div className="mt-3 text-sm text-slate-600 dark:text-slate-300 leading-relaxed border-t border-slate-200 dark:border-slate-700 pt-3">
                                    <p><strong>No.</strong> The core of our privacy-first architecture is that the controller logic runs in your browser. If you close the tab, processing stops immediately. You can switch tabs or minimize the window.</p>
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
                                <a href="mailto:contact@hardbanrecordslab.online" className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-lg">
                                    Email Support
                                </a>
                            </div>
                        </div>
                    </div>
                );

            case 'pricing':
                // Should normally be handled by main PricingModal, but as a fallback:
                return (
                    <div className="text-center py-12">
                        <h3 className="text-xl font-bold mb-4">Please view our Pricing page</h3>
                        <p>Close this window and click "Pricing" in the menu to see interactive plans.</p>
                    </div>
                );

            case 'api':
                return (
                    <div className="space-y-6 animate-fade-in text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                        <div className="flex items-center gap-3">
                            <Code className="w-8 h-8 text-accent-violet" />
                            <h3 className="text-xl font-bold text-light-text dark:text-dark-text">Developer API</h3>
                        </div>
                        <p>Submit audio programmatically and get the same metadata the app produces. Authenticate with your personal API key from <strong>Settings → Security</strong> in the <code>X-API-Key</code> header. Each analysis costs 1 credit, exactly like the UI.</p>

                        <div>
                            <p className="font-bold text-light-text dark:text-dark-text mb-1">1. Submit a track</p>
                            <pre className="bg-slate-900 text-slate-100 text-xs p-4 rounded-xl overflow-x-auto">{`curl -X POST https://metadata.hardbanrecordslab.online/api/analysis/generate \\
  -H "X-API-Key: <your key>" \\
  -F "file=@track.wav" \\
  -F "model_preference=pro"
# -> { "job_id": "..." }`}</pre>
                        </div>
                        <div>
                            <p className="font-bold text-light-text dark:text-dark-text mb-1">2. Poll for the result</p>
                            <pre className="bg-slate-900 text-slate-100 text-xs p-4 rounded-xl overflow-x-auto">{`curl https://metadata.hardbanrecordslab.online/api/analysis/job/<job_id> \\
  -H "X-API-Key: <your key>"
# status: pending | processing | completed | failed`}</pre>
                        </div>
                        <p className="text-xs text-slate-500">Full reference, response schema and export endpoints (DDEX / CWR / CSV / JSON): see <code>docs/API.md</code> in the repository, or the interactive OpenAPI docs at <code>/api/docs</code>.</p>
                        <p className="text-xs text-slate-500">Need higher throughput or a Data Processing Agreement? <a className="text-accent-violet hover:underline" href="mailto:contact@hardbanrecordslab.online">contact us</a>.</p>
                    </div>
                );

            case 'roadmap':
                return (
                    <div className="space-y-8 animate-fade-in relative">
                        {/* Timeline Line */}
                        <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-slate-200 dark:bg-slate-800"></div>

                        <div className="relative pl-12">
                            <div className="absolute left-[9px] top-1.5 w-3.5 h-3.5 bg-green-500 rounded-full border-4 border-white dark:border-dark-card shadow-sm"></div>
                            <div className="mb-1 text-xs font-bold text-green-500 uppercase tracking-wider">Q4 2024</div>
                            <h4 className="font-bold text-lg text-light-text dark:text-dark-text">Beta Launch v1.0</h4>
                            <p className="text-sm text-slate-500 mt-1">Initial release of the core MIR engine and Gemini integration.</p>
                        </div>

                        <div className="relative pl-12">
                            <div className="absolute left-[9px] top-1.5 w-3.5 h-3.5 bg-green-500 rounded-full border-4 border-white dark:border-dark-card shadow-sm"></div>
                            <div className="mb-1 text-xs font-bold text-green-500 uppercase tracking-wider">Q1 2025</div>
                            <h4 className="font-bold text-lg text-light-text dark:text-dark-text">Pro Infrastructure</h4>
                            <p className="text-sm text-slate-500 mt-1">FastAPI backend, user accounts, and batch processing capabilities.</p>
                        </div>

                        <div className="relative pl-12">
                            <div className="absolute left-[9px] top-1.5 w-3.5 h-3.5 bg-accent-violet rounded-full border-4 border-white dark:border-dark-card shadow-lg shadow-accent-violet/50"></div>
                            <div className="mb-1 text-xs font-bold text-accent-violet uppercase tracking-wider">NOW (Q1 2026)</div>
                            <h4 className="font-bold text-lg text-light-text dark:text-dark-text">Engine v1.3 - Stability Update</h4>
                            <p className="text-sm text-slate-500 mt-1">Introduction of Professional Tools, robust MIR formatting, and refined analytics dashboard.</p>
                        </div>

                        <div className="relative pl-12 opacity-75">
                            <div className="absolute left-[9px] top-1.5 w-3.5 h-3.5 bg-slate-300 dark:bg-slate-700 rounded-full border-4 border-white dark:border-dark-card"></div>
                            <div className="mb-1 text-xs font-bold text-slate-400 uppercase tracking-wider">Q2 2026 (Planned)</div>
                            <h4 className="font-bold text-lg text-light-text dark:text-dark-text">Collaborative Studios</h4>
                            <p className="text-sm text-slate-500 mt-1">Team workspaces, shared catalogs, and real-time collaboration on metadata sets.</p>
                        </div>

                        <div className="relative pl-12 opacity-75">
                            <div className="absolute left-[9px] top-1.5 w-3.5 h-3.5 bg-slate-300 dark:bg-slate-700 rounded-full border-4 border-white dark:border-dark-card"></div>
                            <div className="mb-1 text-xs font-bold text-slate-400 uppercase tracking-wider">Q3 2026 (Planned)</div>
                            <h4 className="font-bold text-lg text-light-text dark:text-dark-text">Direct DPS Publishing</h4>
                            <p className="text-sm text-slate-500 mt-1">Automated upload to Spotify for Artists, Apple Music, and Beatport directly from the engine.</p>
                        </div>

                        <div className="relative pl-12 opacity-75">
                            <div className="absolute left-[9px] top-1.5 w-3.5 h-3.5 bg-slate-300 dark:bg-slate-700 rounded-full border-4 border-white dark:border-dark-card"></div>
                            <div className="mb-1 text-xs font-bold text-slate-400 uppercase tracking-wider">Q4 2026 (Planned)</div>
                            <h4 className="font-bold text-lg text-light-text dark:text-dark-text">DAW Bridge (VST/AU)</h4>
                            <p className="text-sm text-slate-500 mt-1">Integration directly into Ableton Live, FL Studio, and Logic Pro for real-time metadata syncing.</p>
                        </div>
                    </div>
                );


            case 'status':
                return (
                    <div className="space-y-6 animate-fade-in">
                        <div className="flex items-center gap-4 p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-200 dark:border-emerald-800">
                            <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]"></div>
                            <div>
                                <h4 className="font-bold text-emerald-800 dark:text-emerald-300">All Systems Operational</h4>
                                <p className="text-xs text-emerald-600 dark:text-emerald-400">Core Engine • AI Nodes • Database</p>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">Service Health</h4>

                            <div className="flex justify-between items-center p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50">
                                <span className="text-sm font-medium">AI ensemble (Groq / Gemini / OpenRouter)</span>
                                <span className="text-xs font-bold text-emerald-500 bg-emerald-100 dark:bg-emerald-900/30 px-2 py-1 rounded">Operational</span>
                            </div>
                            <div className="flex justify-between items-center p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50">
                                <span className="text-sm font-medium">ACRCloud / AcoustID</span>
                                <span className="text-xs font-bold text-emerald-500 bg-emerald-100 dark:bg-emerald-900/30 px-2 py-1 rounded">Operational</span>
                            </div>
                            <div className="flex justify-between items-center p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50">
                                <span className="text-sm font-medium">Database</span>
                                <span className="text-xs font-bold text-emerald-500 bg-emerald-100 dark:bg-emerald-900/30 px-2 py-1 rounded">Operational</span>
                            </div>
                            <div className="flex justify-between items-center p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50">
                                <span className="text-sm font-medium">Processing Queue</span>
                                <span className="text-xs font-bold text-emerald-500 bg-emerald-100 dark:bg-emerald-900/30 px-2 py-1 rounded">Operational</span>
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
