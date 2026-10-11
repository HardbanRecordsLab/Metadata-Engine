
import React from 'react';
import { Shield, FileSignature, Lock, Database, X, AlertCircle, Info } from './icons';
import Button from './Button';

export type LegalDocType = 'privacy' | 'tos' | 'gdpr' | 'cookies' | 'ai_disclaimer';

interface LegalModalProps {
  type: LegalDocType | null;
  onClose: () => void;
}

const LegalModal: React.FC<LegalModalProps> = ({ type, onClose }) => {
  if (!type) return null;

  const ownerData = {
    name: "Kamil Skomra",
    company: "HardbanRecords Lab",
    address: "Poland (correspondence address on request: legal@hardbanrecordslab.online)",
    email: "contact@hardbanrecordslab.online",
    website: "https://hardbanrecordslab.online",
    app: "https://app-metadata.hardbanrecordslab.online/",
    jurisdiction: "Republic of Poland",
    court: "District Court appropriate for the Service Provider's seat"
  };

  // The binding legal documents are shared by the whole HardbanRecords Lab platform and
  // live (in Polish) on hardbanrecordslab.online — one source for every app. This modal
  // only summarises what applies to Metadata Engine.
  const SITE = 'https://hardbanrecordslab.online';
  const docLinks = [
    { href: `${SITE}/terms/`, label: 'Regulamin (Terms)' },
    { href: `${SITE}/privacy/`, label: 'Polityka prywatności (Privacy Policy)' },
    { href: `${SITE}/cookies/`, label: 'Polityka cookies (Cookies)' },
  ];

  const summaries: Record<LegalDocType, string[]> = {
    privacy: [
      'Controller: Kamil Skomra, trading as HardbanRecords Lab (Poland). Data-protection contact: legal@hardbanrecordslab.online.',
      'Your browser runs a quick local preview. For the full analysis the file is uploaded to our server in Germany (Contabo) and deleted promptly after the analysis; only the resulting metadata and, if you save it, your analysis history are kept.',
      'AI classification (Google Gemini, Groq, OpenRouter) receives the audio and/or a compact feature representation. Identification (ACRCloud, AcoustID, MusicBrainz) receives a fingerprint or a short snippet; enrichment (Spotify, Last.fm, Discogs) receives only title, artist or an identifier.',
      'Payments are handled by Stripe; we never receive card data. Billing records are kept 5 years from the end of the tax year.',
      'You can delete your account at any time in Settings → Security. You have the rights of access, rectification, erasure, restriction, portability and objection, and may complain to the Polish supervisory authority (UODO).',
    ],
    gdpr: [
      'Metadata Engine is covered by the HardbanRecords Lab privacy policy, which meets the information duties of Articles 13 and 14 GDPR.',
      'Transfers outside the EEA (AI inference, payments) rely on the EU–US Data Privacy Framework or Standard Contractual Clauses.',
      'Requests about your data: legal@hardbanrecordslab.online — we reply within one month.',
    ],
    tos: [
      'The service is sold as one-time credit packs, not a subscription. One credit is used per full analysis; new accounts get a few free credits.',
      'HardbanRecords Lab is VAT-exempt (Art. 113 of the Polish VAT Act): prices are final and we issue a receipt (rachunek) on request.',
      'Consumers may withdraw within 14 days. The right ends once credits are delivered at your express request, after you confirm you lose it — this is asked at checkout.',
      'Upload only files you have the rights to. Your files stay yours and are never used to train AI models.',
      'Complaints: legal@hardbanrecordslab.online — answered within 14 days. Polish law applies; consumers keep the protection of their home country’s mandatory rules.',
    ],
    cookies: [
      'We use no analytics or advertising cookies, so we do not ask for consent.',
      'Your browser stores only what keeps you signed in and your mode setting (local storage). Stripe sets its own cookies on its payment page.',
    ],
    ai_disclaimer: [
      'Genres, moods, descriptions and tags are AI suggestions. Check them before publishing or submitting to distributors.',
      'Purely AI-generated text or images may not be protected by copyright.',
      'Do not use the service to create misleading content that imitates real people (deepfakes).',
    ],
  };

  const renderContent = () => (
    <div className="space-y-6 text-slate-700 dark:text-slate-300 leading-relaxed text-sm">
      <ul className="list-disc pl-5 space-y-3">
        {summaries[type].map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ul>
      <div>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
          Binding documents (in Polish), common to all HardbanRecords Lab apps:
        </p>
        <div className="flex flex-wrap gap-2">
          {docLinks.map((d) => (
            <a
              key={d.href}
              href={d.href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs px-3 py-1.5 rounded-md border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              {d.label} ↗
            </a>
          ))}
        </div>
      </div>
    </div>
  );


  const titles: Record<LegalDocType, string> = {
      privacy: 'Privacy Policy',
      tos: 'Terms of Service',
      gdpr: 'GDPR Compliance Statement',
      cookies: 'Cookie & Storage Policy',
      ai_disclaimer: 'AI & Content Disclaimer'
  };

  const icons: Record<LegalDocType, React.ReactNode> = {
      privacy: <Lock className="w-6 h-6 text-white" />,
      tos: <FileSignature className="w-6 h-6 text-white" />,
      gdpr: <Shield className="w-6 h-6 text-white" />,
      cookies: <Database className="w-6 h-6 text-white" />,
      ai_disclaimer: <Info className="w-6 h-6 text-white" />
  };

  return (
    <div 
      className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center p-4 animate-fade-in backdrop-blur-sm"
      onClick={onClose}
    >
      <div 
        className="bg-light-card dark:bg-dark-card rounded-2xl shadow-2xl w-full max-w-4xl border border-slate-200 dark:border-slate-800 relative overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
             <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-slate-600 to-slate-800 rounded-xl flex items-center justify-center shrink-0 shadow-lg">
                    {icons[type]}
                </div>
                <div>
                    <h2 className="text-2xl font-bold text-light-text dark:text-dark-text tracking-tight">
                        {titles[type]}
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-1">
                        OFFICIAL LEGAL DOCUMENT • {ownerData.company.toUpperCase()}
                    </p>
                </div>
            </div>
            <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors" aria-label="Close modal">
                <X className="w-6 h-6 text-slate-500" />
            </button>
        </div>
        
        {/* Content */}
        <div className="p-8 overflow-y-auto custom-scrollbar bg-white dark:bg-dark-card">
            <div className="max-w-3xl mx-auto">
                {renderContent()}
                
                <div className="mt-12 pt-8 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-400 flex flex-col sm:flex-row justify-between gap-6 font-mono">
                    <div>
                        <strong>{ownerData.company}</strong><br/>
                        {ownerData.address}<br/>
                        {ownerData.jurisdiction}
                    </div>
                    <div className="text-right">
                        Support: {ownerData.email}<br/>
                        Web: {ownerData.website}<br/>
                        App: {ownerData.app}<br/>
                        &copy; {new Date().getFullYear()} All Rights Reserved.
                    </div>
                </div>
            </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3">
            <Button onClick={onClose} variant="secondary">
                I Acknowledge & Close
            </Button>
        </div>
      </div>
    </div>
  );
};

export default LegalModal;
