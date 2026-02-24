
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
    address: "Poland, EU",
    email: "hardbanrecordslab.pl@gmail.com",
    website: "musicmetadata.ai",
    jurisdiction: "Republic of Poland",
    court: "District Court appropriate for the Service Provider's seat"
  };

  const renderContent = () => {
    switch (type) {
      case 'privacy':
        return (
          <div className="space-y-8 text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-normal text-justify">
            <div className="border-b border-slate-200 dark:border-slate-800 pb-4 mb-4">
                <h1 className="text-3xl font-black text-slate-900 dark:text-white mb-2">Privacy Policy</h1>
                <p className="text-xs uppercase font-bold text-slate-400">Effective Date: December 12, 2025</p>
                <p className="text-xs uppercase font-bold text-slate-400">Version: 2.1 (Global SaaS with Merchant of Record)</p>
            </div>
            
            <section>
                <h3 className="text-xl font-bold text-light-text dark:text-dark-text mb-4">1. Introduction and Scope</h3>
                <p className="mb-2">Welcome to Music Metadata Engine ("Company", "we", "our", "us"). We respect the privacy of our users ("User", "you") and are committed to protecting your personal data. This comprehensive Privacy Policy explains strictly how we collect, use, disclose, and safeguard your information when you access our software-as-a-service application, website, and related API services (collectively, the "Service").</p>
                <p>We operate on a "Privacy by Design" basis. Our architecture is fundamentally designed to minimize data collection. By using the Service, you consent to the data practices described in this policy. If you do not agree with the terms of this privacy policy, please do not access the application.</p>
            </section>
            
            <section>
                <h3 className="text-xl font-bold text-light-text dark:text-dark-text mb-4">2. Identity of the Data Controller</h3>
                <p>For the purposes of the General Data Protection Regulation (GDPR) and other applicable data protection laws, the Data Controller of your personal information is:</p>
                <div className="mt-2 p-4 bg-slate-100 dark:bg-slate-800 rounded-lg text-sm font-mono border-l-4 border-accent-violet">
                    <strong>{ownerData.company}</strong><br/>
                    Registered Address: {ownerData.address}<br/>
                    Jurisdiction: {ownerData.jurisdiction}<br/>
                    Data Protection Officer Contact: <a href={`mailto:${ownerData.email}`} className="text-accent-violet hover:underline">{ownerData.email}</a>
                </div>
            </section>

            <section>
                <h3 className="text-xl font-bold text-light-text dark:text-dark-text mb-4">3. Data Architecture & Audio Processing</h3>
                <p className="mb-2 font-bold">3.1. Client-Side First Processing</p>
                <p className="mb-2">A core feature of Music Metadata Engine is its client-side architecture. When you use the Service to analyze audio files, the Digital Signal Processing (DSP) algorithms (such as BPM detection, key detection, and spectral analysis via Essentia.js/WASM) run locally within your web browser environment. <strong>We do not upload your full audio files to our servers for persistent storage.</strong></p>
                
                <p className="mb-2 font-bold">3.2. Temporary Data Transmission for AI & Identification</p>
                <p className="mb-2">To provide advanced features, specific, minimized data packets must be transmitted to third-party providers:</p>
                <ul className="list-disc pl-5 space-y-2 mt-2">
                    <li><strong>Google Gemini API (AI Analysis):</strong> When you request AI metadata generation, a temporary buffer of the audio file or a compressed representation is sent securely to Google's servers for inference. This data is processed in ephemeral instances and is not used by Google to train their base foundation models (subject to Google Cloud Enterprise privacy terms).</li>
                    <li><strong>ACRCloud / AcoustID:</strong> For track identification, a "fingerprint" (a mathematical summary of the audio) or a small audio snippet (first 1MB) is transmitted. The full original file is never stored by these providers.</li>
                </ul>
            </section>
            
            <section>
                <h3 className="text-xl font-bold text-light-text dark:text-dark-text mb-4">4. Types of Data We Collect</h3>
                <p className="mb-2">We collect only the data necessary to provide the Service, comply with legal obligations, and improve our products.</p>
                
                <h4 className="font-bold mt-4 mb-2 text-slate-700 dark:text-slate-200">4.1. Personal Data</h4>
                <ul className="list-disc pl-5 space-y-1">
                    <li><strong>Identity Data:</strong> Full name, username, or alias provided during registration.</li>
                    <li><strong>Contact Data:</strong> Email address used for authentication and billing communication.</li>
                    <li><strong>Authentication Data:</strong> Encrypted passwords (hashed), OAuth tokens (Google Login), and session cookies via Supabase Auth.</li>
                </ul>

                <h4 className="font-bold mt-4 mb-2 text-slate-700 dark:text-slate-200">4.2. Usage & Technical Data</h4>
                <ul className="list-disc pl-5 space-y-1">
                    <li><strong>Log Data:</strong> IP address, browser type, operating system, referral URLs, device information, and timestamps of access.</li>
                    <li><strong>Analysis History:</strong> We store the <i>metadata results</i> (e.g., "Genre: House", "BPM: 124") of your analyses in our database to provide you with a history log. We do not store the audio files themselves.</li>
                    <li><strong>Error Reports:</strong> Stack traces and error codes to identify bugs.</li>
                </ul>

                <h4 className="font-bold mt-4 mb-2 text-slate-700 dark:text-slate-200">4.3. Financial Data (Processed by Lemon Squeezy)</h4>
                <p>We <strong>do not</strong> store or process your credit card numbers, bank account details, or full billing address on our servers.</p>
                <p className="mt-2">All payments are handled by our Merchant of Record, <strong>Lemon Squeezy, LLC</strong>. When you make a purchase:</p>
                <ul className="list-disc pl-5 mt-1 space-y-1">
                    <li>Lemon Squeezy acts as the reseller of the software.</li>
                    <li>They collect and process payment information in accordance with their own Privacy Policy.</li>
                    <li>We only receive a transaction identifier (Order ID), subscription status (Active/Cancelled), and the email associated with the purchase to grant you access to Pro features.</li>
                </ul>
            </section>

            <section>
                <h3 className="text-xl font-bold text-light-text dark:text-dark-text mb-4">5. Purpose and Legal Basis for Processing</h3>
                <table className="w-full text-left border-collapse border border-slate-200 dark:border-slate-700 mt-4 rounded-lg overflow-hidden">
                    <thead>
                        <tr className="bg-slate-100 dark:bg-slate-800">
                            <th className="p-3 border border-slate-200 dark:border-slate-700 font-bold">Purpose</th>
                            <th className="p-3 border border-slate-200 dark:border-slate-700 font-bold">Legal Basis (GDPR)</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td className="p-3 border border-slate-200 dark:border-slate-700">Providing the Service (Analysis, Metadata Generation)</td>
                            <td className="p-3 border border-slate-200 dark:border-slate-700">Performance of Contract (Art. 6(1)(b))</td>
                        </tr>
                        <tr>
                            <td className="p-3 border border-slate-200 dark:border-slate-700">Billing and Subscription Management</td>
                            <td className="p-3 border border-slate-200 dark:border-slate-700">Performance of Contract & Legal Obligation (Art. 6(1)(c))</td>
                        </tr>
                        <tr>
                            <td className="p-3 border border-slate-200 dark:border-slate-700">Security & Fraud Prevention</td>
                            <td className="p-3 border border-slate-200 dark:border-slate-700">Legitimate Interest (Art. 6(1)(f))</td>
                        </tr>
                        <tr>
                            <td className="p-3 border border-slate-200 dark:border-slate-700">Sending Product Updates & Newsletters</td>
                            <td className="p-3 border border-slate-200 dark:border-slate-700">Consent (Opt-in) (Art. 6(1)(a))</td>
                        </tr>
                    </tbody>
                </table>
            </section>

            <section>
                <h3 className="text-xl font-bold text-light-text dark:text-dark-text mb-4">6. Data Sharing and Third Parties</h3>
                <p>We do not sell your personal data. We share data only with the following sub-processors required to operate the infrastructure:</p>
                <ul className="list-disc pl-5 mt-2 space-y-2">
                    <li><strong>Supabase (USA/Global):</strong> For database hosting, authentication, and backend logic. Protected by Standard Contractual Clauses (SCCs).</li>
                    <li><strong>Google Cloud Platform / Vertex AI (USA):</strong> For generative AI processing.</li>
                    <li><strong>Lemon Squeezy (USA):</strong> Merchant of Record. They handle tax compliance (VAT, Sales Tax), invoicing, and payment processing globally.</li>
                    <li><strong>Vercel (USA):</strong> For frontend hosting and edge network delivery.</li>
                </ul>
            </section>

            <section>
                <h3 className="text-xl font-bold text-light-text dark:text-dark-text mb-4">7. International Data Transfers</h3>
                <p>Your information, including Personal Data, may be transferred to — and maintained on — computers located outside of your state, province, country, or other governmental jurisdiction where the data protection laws may differ from those of your jurisdiction. If you are located outside the United States and choose to provide information to us, please note that we transfer the data, including Personal Data, to the United States and process it there. We utilize Standard Contractual Clauses (SCCs) approved by the European Commission to ensure the security of such transfers.</p>
            </section>

            <section>
                <h3 className="text-xl font-bold text-light-text dark:text-dark-text mb-4">8. Data Retention Policy</h3>
                <p>We will retain your Personal Data only for as long as is necessary for the purposes set out in this Privacy Policy.</p>
                <ul className="list-disc pl-5 mt-2 space-y-1">
                    <li><strong>Account Data:</strong> Retained as long as your account is active. Deleted 30 days after account closure request.</li>
                    <li><strong>Transaction Data:</strong> Retained for 5-7 years as required by tax laws in Poland and applicable jurisdictions (handled primarily by Lemon Squeezy).</li>
                    <li><strong>Temporary Audio Data:</strong> Discarded immediately after analysis is complete.</li>
                </ul>
            </section>

            <section>
                <h3 className="text-xl font-bold text-light-text dark:text-dark-text mb-4">9. Children's Privacy</h3>
                <p>Our Service does not address anyone under the age of 16. We do not knowingly collect personally identifiable information from anyone under the age of 16. If You are a parent or guardian and You are aware that Your child has provided Us with Personal Data, please contact Us. If We become aware that We have collected Personal Data from anyone under the age of 16 without verification of parental consent, We take steps to remove that information from Our servers.</p>
            </section>

            <section>
                <h3 className="text-xl font-bold text-light-text dark:text-dark-text mb-4">10. Contact Us</h3>
                <p>If you have any questions about this Privacy Policy, please contact us:</p>
                <p className="mt-2">
                    By email: <a href={`mailto:${ownerData.email}`} className="text-accent-violet font-bold">{ownerData.email}</a><br/>
                    By visiting this page on our website: {ownerData.website}/contact
                </p>
            </section>
          </div>
        );
      case 'tos':
        return (
          <div className="space-y-8 text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-normal text-justify">
            <div className="border-b border-slate-200 dark:border-slate-800 pb-4 mb-4">
                <h1 className="text-3xl font-black text-slate-900 dark:text-white mb-2">Terms of Service</h1>
                <p className="text-xs uppercase font-bold text-slate-400">Effective Date: December 12, 2025</p>
                <p className="text-xs uppercase font-bold text-slate-400">Agreement Type: Terms of Service (SaaS)</p>
            </div>

            <section>
                <h3 className="text-xl font-bold text-light-text dark:text-dark-text mb-4">1. Agreement to Terms</h3>
                <p className="mb-2">These Terms of Service constitute a legally binding agreement made between you, whether personally or on behalf of an entity ("you") and <strong>{ownerData.company}</strong> ("Company", "we", "us", or "our"), concerning your access to and use of the Music Metadata Engine web application and website (the "Service").</p>
                <p>YOU AGREE THAT BY ACCESSING THE SITE, YOU HAVE READ, UNDERSTOOD, AND AGREED TO BE BOUND BY ALL OF THESE TERMS OF SERVICE. IF YOU DO NOT AGREE WITH ALL OF THESE TERMS, THEN YOU ARE EXPRESSLY PROHIBITED FROM USING THE SITE AND YOU MUST DISCONTINUE USE IMMEDIATELY.</p>
            </section>

            <section>
                <h3 className="text-xl font-bold text-light-text dark:text-dark-text mb-4">2. Intellectual Property Rights</h3>
                
                <h4 className="font-bold mt-4 mb-2 text-slate-700 dark:text-slate-200">2.1. Our Intellectual Property</h4>
                <p>Unless otherwise indicated, the Service is our proprietary property and all source code, databases, functionality, software, website designs, audio, video, text, photographs, and graphics on the Site (collectively, the "Content") and the trademarks, service marks, and logos contained therein (the "Marks") are owned or controlled by us or licensed to us, and are protected by copyright and trademark laws.</p>

                <h4 className="font-bold mt-4 mb-2 text-slate-700 dark:text-slate-200">2.2. Your Intellectual Property (Input Data)</h4>
                <p>We do not claim any ownership rights over the audio files, metadata, or other materials you upload to the Service ("User Content"). You retain full copyright and ownership of your music. By uploading User Content, you grant us a worldwide, non-exclusive, royalty-free license to use, reproduce, and process the User Content <strong>solely for the purpose of providing the Service</strong> (e.g., performing analysis, generating metadata) and for no other purpose.</p>

                <h4 className="font-bold mt-4 mb-2 text-slate-700 dark:text-slate-200">2.3. Ownership of Output Data</h4>
                <p>Subject to your compliance with these Terms, we hereby assign to you all right, title, and interest in and to the metadata, text descriptions, and analysis results generated by the Service based on your User Content. <strong>Note regarding AI-generated assets:</strong> Currently, under US and EU law, purely AI-generated images or text without significant human modification may not be eligible for copyright protection. Use them at your own discretion.</p>
            </section>

            <section>
                <h3 className="text-xl font-bold text-light-text dark:text-dark-text mb-4">3. User Representations and Prohibited Activities</h3>
                <p>By using the Service, you represent and warrant that:</p>
                <ol className="list-decimal pl-5 space-y-2 mt-2">
                    <li>You have the legal capacity and you agree to comply with these Terms of Service.</li>
                    <li>You are not a minor in the jurisdiction in which you reside.</li>
                    <li>You will not access the Service through automated or non-human means, whether through a bot, script, or otherwise (unless via our official API).</li>
                    <li>You will not use the Service for any illegal or unauthorized purpose.</li>
                    <li><strong>Copyright Compliance:</strong> You warrant that you own the copyright to any audio files you upload or have explicit written permission from the copyright holder to analyze and process them. We strictly prohibit the use of our Service to process pirated or infringing content.</li>
                </ol>
                <p className="mt-4">You may not:</p>
                <ul className="list-disc pl-5 mt-2 space-y-1">
                    <li>Reverse engineer, decompile, or disassemble the software.</li>
                    <li>Use the Service to generate metadata for deepfakes or malicious content.</li>
                    <li>Share your account credentials with third parties (seat sharing is prohibited unless on an Enterprise plan).</li>
                </ul>
            </section>

            <section>
                <h3 className="text-xl font-bold text-light-text dark:text-dark-text mb-4">4. Subscriptions, Payments, and Billing (Lemon Squeezy)</h3>
                <p className="mb-2"><strong>4.1. Merchant of Record:</strong> Our order process is conducted by our online reseller <strong>Lemon Squeezy</strong>. Lemon Squeezy is the Merchant of Record for all our orders. Lemon Squeezy provides all customer service inquiries and handles returns.</p>
                <p className="mb-2"><strong>4.2. Billing Cycle:</strong> The Service is billed on a subscription basis (monthly or annually). You will be billed in advance on a recurring and periodic basis directly by Lemon Squeezy.</p>
                <p className="mb-2"><strong>4.3. Taxes:</strong> Prices displayed on our website may or may not include taxes depending on your location. Lemon Squeezy automatically calculates and collects the appropriate Value Added Tax (VAT), GST, or Sales Tax based on your billing address in accordance with local laws.</p>
                <p className="mb-2"><strong>4.4. Cancellation:</strong> You may cancel your subscription at any time via the user dashboard or the link provided in your email invoice from Lemon Squeezy. Your access will continue until the end of the current billing period.</p>
                <p className="mb-2"><strong>4.5. Refunds:</strong> We offer a 14-day refund policy for the initial purchase if you are not satisfied, provided you have not used more than 20% of the allocated credits for that month. Refunds for renewals are granted at our sole discretion. All refund requests must be directed through Lemon Squeezy or our support.</p>
                <p className="mb-2"><strong>4.6. Fee Changes:</strong> We reserve the right to modify the pricing of our Service at any time. Any price change will become effective at the end of the then-current billing cycle.</p>
            </section>

            <section>
                <h3 className="text-xl font-bold text-light-text dark:text-dark-text mb-4">5. Disclaimer of Warranties</h3>
                <p className="uppercase font-bold text-xs bg-slate-100 dark:bg-slate-800 p-4 rounded-lg">THE SITE AND SERVICE ARE PROVIDED ON AN "AS-IS" AND "AS-AVAILABLE" BASIS. YOU AGREE THAT YOUR USE OF THE SITE AND OUR SERVICES WILL BE AT YOUR SOLE RISK. TO THE FULLEST EXTENT PERMITTED BY LAW, WE DISCLAIM ALL WARRANTIES, EXPRESS OR IMPLIED, IN CONNECTION WITH THE SITE AND YOUR USE THEREOF, INCLUDING, WITHOUT LIMITATION, THE IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.</p>
                <p className="mt-2">We make no warranties or representations about the accuracy or completeness of the metadata generated by the AI models. AI models can "hallucinate" or produce factually incorrect data. You are solely responsible for verifying all metadata before distributing your music to DSPs (Spotify, Apple Music, etc.).</p>
            </section>

            <section>
                <h3 className="text-xl font-bold text-light-text dark:text-dark-text mb-4">6. Limitation of Liability</h3>
                <p>IN NO EVENT WILL WE OR OUR DIRECTORS, EMPLOYEES, OR AGENTS BE LIABLE TO YOU OR ANY THIRD PARTY FOR ANY DIRECT, INDIRECT, CONSEQUENTIAL, EXEMPLARY, INCIDENTAL, SPECIAL, OR PUNITIVE DAMAGES, INCLUDING LOST PROFIT, LOST REVENUE, LOSS OF DATA, OR OTHER DAMAGES ARISING FROM YOUR USE OF THE SITE, EVEN IF WE HAVE BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES. NOTWITHSTANDING ANYTHING TO THE CONTRARY CONTAINED HEREIN, OUR LIABILITY TO YOU FOR ANY CAUSE WHATSOEVER AND REGARDLESS OF THE FORM OF THE ACTION, WILL AT ALL TIMES BE LIMITED TO THE AMOUNT PAID, IF ANY, BY YOU TO US DURING THE SIX (6) MONTH PERIOD PRIOR TO ANY CAUSE OF ACTION ARISING.</p>
            </section>

            <section>
                <h3 className="text-xl font-bold text-light-text dark:text-dark-text mb-4">7. Indemnification</h3>
                <p>You agree to defend, indemnify, and hold us harmless, including our subsidiaries, affiliates, and all of our respective officers, agents, partners, and employees, from and against any loss, damage, liability, claim, or demand, including reasonable attorneys’ fees and expenses, made by any third party due to or arising out of: (1) your User Content; (2) use of the Site; (3) breach of these Terms of Service; or (4) any overt harmful act toward any other user of the Site.</p>
            </section>

            <section>
                <h3 className="text-xl font-bold text-light-text dark:text-dark-text mb-4">8. Governing Law and Dispute Resolution</h3>
                <p>These Terms shall be governed by and defined following the laws of <strong>{ownerData.jurisdiction}</strong>. {ownerData.company} and yourself irrevocably consent that the courts of {ownerData.court} shall have exclusive jurisdiction to resolve any dispute which may arise in connection with these terms. For users residing in the EU, nothing in these terms shall deprive you of the protection afforded to you by provisions that cannot be derogated from by agreement by virtue of the law where you have your habitual residence.</p>
            </section>
          </div>
        );
      case 'gdpr':
        return (
          <div className="space-y-8 text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-normal text-justify">
            <div className="border-b border-slate-200 dark:border-slate-800 pb-4 mb-4">
                <h1 className="text-3xl font-black text-slate-900 dark:text-white mb-2">GDPR Compliance</h1>
                <p className="text-xs uppercase font-bold text-slate-400">Scope: European Economic Area (EEA)</p>
                <p className="text-xs uppercase font-bold text-slate-400">Regulation: (EU) 2016/679 (General Data Protection Regulation)</p>
            </div>

            <section>
                <h3 className="text-xl font-bold text-light-text dark:text-dark-text mb-4">1. Your GDPR Rights Explained</h3>
                <p className="mb-2">Music Metadata Engine is committed to full compliance with the General Data Protection Regulation. If you are a resident of the European Economic Area (EEA), you have the following rights regarding your personal data:</p>
                
                <div className="space-y-4 mt-4">
                    <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-lg">
                        <h4 className="font-bold text-accent-violet mb-1">1. The Right to Access (Article 15)</h4>
                        <p>You have the right to request copies of your personal data. We may charge you a small fee for this service only if the request is manifestly unfounded or excessive.</p>
                    </div>
                    <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-lg">
                        <h4 className="font-bold text-accent-violet mb-1">2. The Right to Rectification (Article 16)</h4>
                        <p>You have the right to request that we correct any information you believe is inaccurate. You also have the right to request that we complete the information you believe is incomplete.</p>
                    </div>
                    <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-lg">
                        <h4 className="font-bold text-accent-violet mb-1">3. The Right to Erasure / "Right to be Forgotten" (Article 17)</h4>
                        <p>You have the right to request that we erase your personal data, under certain conditions (e.g., if the data is no longer necessary for the purposes for which it was collected).</p>
                    </div>
                    <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-lg">
                        <h4 className="font-bold text-accent-violet mb-1">4. The Right to Restrict Processing (Article 18)</h4>
                        <p>You have the right to request that we restrict the processing of your personal data, under certain conditions.</p>
                    </div>
                    <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-lg">
                        <h4 className="font-bold text-accent-violet mb-1">5. The Right to Data Portability (Article 20)</h4>
                        <p>You have the right to request that we transfer the data that we have collected to another organization, or directly to you, in a structured, commonly used, and machine-readable format (JSON or CSV).</p>
                    </div>
                </div>
            </section>

            <section>
                <h3 className="text-xl font-bold text-light-text dark:text-dark-text mb-4">2. Data Processing Agreement (DPA)</h3>
                <p>For our B2B customers and Enterprise users, we offer a standard Data Processing Agreement (DPA) that governs the processing of personal data on your behalf. If you require a signed DPA for your compliance records, please contact our support team.</p>
            </section>

            <section>
                <h3 className="text-xl font-bold text-light-text dark:text-dark-text mb-4">3. Data Breach Notification</h3>
                <p>In the event of a personal data breach that is likely to result in a high risk to your rights and freedoms, we will notify you and the competent supervisory authority within 72 hours of becoming aware of the breach, in accordance with Articles 33 and 34 of the GDPR.</p>
            </section>

            <section>
                <h3 className="text-xl font-bold text-light-text dark:text-dark-text mb-4">4. Cross-Border Data Transfers</h3>
                <p>As we use servers located in the United States (via Supabase and Google Cloud), your data is transferred outside the EEA. We ensure that such transfers are lawful by relying on:</p>
                <ul className="list-disc pl-5 mt-2">
                    <li><strong>Standard Contractual Clauses (SCCs):</strong> Our contracts with US-based providers incorporate the EU Commission's approved standard contractual clauses.</li>
                    <li><strong>Adequacy Decisions:</strong> Where applicable (e.g., EU-US Data Privacy Framework).</li>
                </ul>
            </section>

            <section>
                <h3 className="text-xl font-bold text-light-text dark:text-dark-text mb-4">5. How to Exercise Your Rights</h3>
                <p>If you make a request, we have one month to respond to you. If you would like to exercise any of these rights, please contact us via email at:</p>
                <p className="mt-2 font-bold text-lg">{ownerData.email}</p>
                <p className="text-xs text-slate-500 mt-2">Please use the subject line: "GDPR Request - [Your Name]". We may request specific information from you to help us confirm your identity.</p>
            </section>
          </div>
        );
      case 'cookies':
        return (
           <div className="space-y-8 text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-normal text-justify">
            <div className="border-b border-slate-200 dark:border-slate-800 pb-4 mb-4">
                <h1 className="text-3xl font-black text-slate-900 dark:text-white mb-2">Cookies Policy</h1>
                <p className="text-xs uppercase font-bold text-slate-400">Effective Date: December 12, 2025</p>
            </div>

            <section>
                <h3 className="text-xl font-bold text-light-text dark:text-dark-text mb-4">1. What Are Cookies?</h3>
                <p>Cookies are small text files that are placed on your computer or mobile device by websites that you visit. They are widely used in order to make websites work, or work more efficiently, as well as to provide information to the owners of the site. "Local Storage" is a similar technology that allows a website to store data on your computer.</p>
            </section>

            <section>
                <h3 className="text-xl font-bold text-light-text dark:text-dark-text mb-4">2. How We Use Cookies and Local Storage</h3>
                <p>Music Metadata Engine aims to be as lightweight as possible. We prioritize Local Storage over traditional Cookies for session management. We classify our storage usage into the following categories:</p>

                <div className="mt-6 space-y-6">
                    <div>
                        <h4 className="font-bold text-light-text dark:text-dark-text border-b border-slate-200 dark:border-slate-800 pb-1 mb-2">A. Strictly Necessary (Essential)</h4>
                        <p className="mb-2">These are essential for the website to function properly. Without these, you cannot log in or use the core features.</p>
                        <ul className="list-disc pl-5 space-y-1 text-xs font-mono bg-slate-100 dark:bg-slate-800 p-3 rounded">
                            <li><strong>sb-access-token:</strong> (Local Storage) Used by Supabase to maintain your secure login session.</li>
                            <li><strong>sb-refresh-token:</strong> (Local Storage) Used to refresh your session without forcing you to log in repeatedly.</li>
                            <li><strong>mme_theme:</strong> (Local Storage) Remembers your Dark Mode/Light Mode preference.</li>
                        </ul>
                    </div>

                    <div>
                        <h4 className="font-bold text-light-text dark:text-dark-text border-b border-slate-200 dark:border-slate-800 pb-1 mb-2">B. Functionality & Preferences</h4>
                        <p className="mb-2">These allow the website to remember choices you make to provide enhanced functionality.</p>
                        <ul className="list-disc pl-5 space-y-1 text-xs font-mono bg-slate-100 dark:bg-slate-800 p-3 rounded">
                            <li><strong>mme_isrc_prefix:</strong> Stores your preferred ISRC prefix for code generation.</li>
                            <li><strong>mme_cat_sequence:</strong> Stores the counter for your catalog numbers.</li>
                            <li><strong>music-metadata-autosave:</strong> Temporarily saves your work-in-progress edits to prevent data loss if the browser crashes.</li>
                        </ul>
                    </div>

                    <div>
                        <h4 className="font-bold text-light-text dark:text-dark-text border-b border-slate-200 dark:border-slate-800 pb-1 mb-2">C. Analytics & Performance</h4>
                        <p className="mb-2">We use minimal analytics to understand how users interact with the application (e.g., which features are used most). This data is anonymized.</p>
                        <ul className="list-disc pl-5 space-y-1 text-xs font-mono bg-slate-100 dark:bg-slate-800 p-3 rounded">
                            <li><strong>PostHog / Google Analytics 4:</strong> (Optional) Cookies used to track session duration and page views. You can opt-out of these.</li>
                        </ul>
                    </div>
                </div>
            </section>

            <section>
                <h3 className="text-xl font-bold text-light-text dark:text-dark-text mb-4">3. Third-Party Cookies (Lemon Squeezy)</h3>
                <p>In addition to our own cookies, we may also use various third-parties cookies to report usage statistics of the Service and handle payments.</p>
                <ul className="list-disc pl-5 mt-2 space-y-1">
                    <li><strong>Lemon Squeezy:</strong> When you initiate a checkout process, Lemon Squeezy may place cookies to process payments securely, remember your cart contents, and detect fraud. By proceeding to checkout, you agree to Lemon Squeezy's Cookie Policy.</li>
                    <li><strong>Google Identity:</strong> If you use "Sign in with Google", Google may place cookies for authentication purposes.</li>
                </ul>
            </section>

            <section>
                <h3 className="text-xl font-bold text-light-text dark:text-dark-text mb-4">4. Managing Your Preferences</h3>
                <p>Most web browsers allow you to control cookies through their settings preferences. However, if you limit the ability of websites to set cookies, you may worsen your overall user experience, since it will no longer be personalized to you. It may also stop you from saving customized settings like login information.</p>
                <p className="mt-2">To disable Local Storage or Cookies, please refer to your browser's "Help" section (search for "Clear browsing data" or "Site Settings").</p>
            </section>
          </div>
        );
      case 'ai_disclaimer':
        return (
            <div className="space-y-8 text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-normal text-justify">
                <div className="p-6 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl flex gap-4 items-start shadow-sm">
                    <AlertCircle className="w-8 h-8 text-yellow-600 dark:text-yellow-400 shrink-0" />
                    <div>
                        <h4 className="font-bold text-lg text-yellow-700 dark:text-yellow-400 mb-1">AI Generative Content Warning</h4>
                        <p className="text-xs leading-relaxed text-yellow-800 dark:text-yellow-200">
                            This Service utilizes advanced Large Language Models (LLM) including Google Gemini, and generative image models (Imagen). By using these features, you acknowledge the probabilistic nature of Artificial Intelligence.
                        </p>
                    </div>
                </div>

                <section>
                    <h3 className="text-xl font-bold text-light-text dark:text-dark-text mb-4">1. Accuracy and Hallucinations</h3>
                    <p className="mb-2"><strong>1.1. Nature of LLMs:</strong> Artificial Intelligence models are prediction engines, not databases of absolute truth. They generate responses based on statistical probability.</p>
                    <p className="mb-2"><strong>1.2. Risk of Error:</strong> The Music Metadata Engine may occasionally produce "hallucinations" – plausible-sounding but factually incorrect information. This is particularly relevant for:</p>
                    <ul className="list-disc pl-5 space-y-1 mt-1">
                        <li><strong>Historical Trivia:</strong> Descriptions of music history or specific artist biographies may contain errors.</li>
                        <li><strong>BPM/Key Detection:</strong> While generally accurate, AI estimation of tempo and key is an inference, not a measurement. Always verify critical technical data with the DSP (Digital Signal Processing) tools provided in our app or your own ears.</li>
                        <li><strong>Copyright Data:</strong> AI suggestions for copyright owners or publishers are guesses and should never be treated as legal advice.</li>
                    </ul>
                </section>

                <section>
                    <h3 className="text-xl font-bold text-light-text dark:text-dark-text mb-4">2. Intellectual Property of AI Output</h3>
                    <p className="mb-2">The legal status of AI-generated content is evolving rapidly worldwide.</p>
                    <div className="space-y-4 mt-4">
                        <div className="border-l-4 border-accent-violet pl-4">
                            <h4 className="font-bold text-light-text dark:text-dark-text">United States (US Copyright Office)</h4>
                            <p className="text-xs mt-1">Current guidance suggests that content generated <i>entirely</i> by AI without significant human creative input is <strong>not copyrightable</strong>. You may own the prompt, but not the raw output image or text.</p>
                        </div>
                        <div className="border-l-4 border-blue-500 pl-4">
                            <h4 className="font-bold text-light-text dark:text-dark-text">European Union (AI Act)</h4>
                            <p className="text-xs mt-1">The EU AI Act imposes transparency obligations. You should disclose if content you publish (e.g., album art, press releases) was generated by AI.</p>
                        </div>
                    </div>
                    <p className="mt-4"><strong>Our Stance:</strong> {ownerData.company} assigns any rights we may have in the generated content to you, the User. However, we cannot guarantee that you will be able to enforce copyright on raw AI assets.</p>
                </section>

                <section>
                    <h3 className="text-xl font-bold text-light-text dark:text-dark-text mb-4">3. User Responsibility and Indemnification</h3>
                    <p>You agree that you are solely responsible for the content you generate using our Service.</p>
                    <ul className="list-disc pl-5 mt-2 space-y-2">
                        <li><strong>Review Required:</strong> You must review and edit all AI-generated metadata, text, and images before distributing them to Digital Service Providers (Spotify, Apple Music, etc.).</li>
                        <li><strong>Liability:</strong> {ownerData.company} shall not be liable for any rejected releases, takedowns, or copyright strikes resulting from the use of unverified AI-generated metadata.</li>
                        <li><strong>Prohibited Content:</strong> You may not use the AI generation features to create content that is hate speech, sexually explicit, infringing on third-party rights, or otherwise illegal.</li>
                    </ul>
                </section>

                <section>
                    <h3 className="text-xl font-bold text-light-text dark:text-dark-text mb-4">4. Deepfakes and Voice Cloning</h3>
                    <p>Our Service analyzes vocal styles but does not provide voice cloning capabilities intended to impersonate specific individuals without consent. You are strictly prohibited from attempting to use the Service or its API to generate misleading audio content ("Deepfakes") that impersonates real persons.</p>
                </section>
            </div>
        );
      default:
        return null;
    }
  };

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
