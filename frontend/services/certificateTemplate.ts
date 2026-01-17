
import { Metadata } from '../types';

export const generatePremiumCertificateHTML = (metadata: Metadata, hash: string, fileName: string): string => {
    const date = new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });

    const coverArtHtml = metadata.coverArt
        ? `<div class="cover-art"><img src="${metadata.coverArt}" alt="Cover Art"></div>`
        : '<div class="cover-art placeholder"><span>No Cover Art</span></div>';

    // SVG QR Code encoding the hash (simplified representation or using a public service)
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=verify:${hash}`;

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Digital Footprint Certificate - ${metadata.title}</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&family=JetBrains+Mono:wght@400;700&display=swap');
        
        :root {
            --primary: #8b5cf6;
            --secondary: #6366f1;
            --bg: #0f172a;
            --text: #f8fafc;
            --muted: #94a3b8;
            --card-bg: rgba(30, 41, 59, 0.7);
            --accent-glow: rgba(139, 92, 246, 0.3);
        }

        * { margin: 0; padding: 0; box-sizing: border-box; }

        body {
            background-color: var(--bg);
            color: var(--text);
            font-family: 'Outfit', sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            padding: 40px;
            background-image: 
                radial-gradient(circle at 0% 0%, rgba(139, 92, 246, 0.15) 0%, transparent 50%),
                radial-gradient(circle at 100% 100%, rgba(99, 102, 241, 0.15) 0%, transparent 50%);
        }

        .certificate {
            width: 1000px;
            background: var(--card-bg);
            backdrop-filter: blur(12px);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 24px;
            padding: 60px;
            position: relative;
            overflow: hidden;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
            -webkit-print-color-adjust: exact;
        }

        /* Decorative Background Pattern */
        .certificate::before {
            content: '';
            position: absolute;
            top: 0; left: 0; right: 0; bottom: 0;
            background-image: linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
                              linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px);
            background-size: 40px 40px;
            pointer-events: none;
            mask-image: radial-gradient(circle, white, transparent);
        }

        header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 50px;
            position: relative;
        }

        .brand {
            display: flex;
            flex-direction: column;
        }

        .brand h1 {
            font-size: 14px;
            color: var(--primary);
            text-transform: uppercase;
            letter-spacing: 4px;
            margin-bottom: 8px;
            font-weight: 800;
        }

        .brand p {
            font-size: 32px;
            font-weight: 800;
            background: linear-gradient(to right, #fff, var(--muted));
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }

        .cert-number {
            font-family: 'JetBrains Mono', monospace;
            font-size: 12px;
            color: var(--muted);
            background: rgba(0,0,0,0.2);
            padding: 6px 12px;
            border-radius: 6px;
            border: 1px solid rgba(255,255,255,0.05);
        }

        .main-content {
            display: grid;
            grid-template-columns: 320px 1fr;
            gap: 60px;
            position: relative;
        }

        .sidebar {
            display: flex;
            flex-direction: column;
            gap: 30px;
        }

        .cover-art {
            width: 320px;
            height: 320px;
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 20px 40px rgba(0,0,0,0.4);
            border: 1px solid rgba(255,255,255,0.1);
        }

        .cover-art img { width: 100%; height: 100%; object-fit: cover; }
        .cover-art.placeholder {
            background: #1e293b;
            display: flex;
            justify-content: center;
            align-items: center;
            color: var(--muted);
        }

        .qr-section {
            display: flex;
            align-items: center;
            gap: 20px;
            background: rgba(0,0,0,0.2);
            padding: 20px;
            border-radius: 16px;
            border: 1px solid rgba(255,255,255,0.05);
        }

        .qr-code {
            width: 100px;
            height: 100px;
            background: white;
            padding: 8px;
            border-radius: 8px;
        }
        .qr-code img { width: 100%; height: 100%; }

        .qr-text h4 { font-size: 14px; font-weight: 600; margin-bottom: 4px; }
        .qr-text p { font-size: 11px; color: var(--muted); line-height: 1.4; }

        .details {
            display: flex;
            flex-direction: column;
        }

        .fingerprint-box {
            background: rgba(139, 92, 246, 0.05);
            border: 1px solid rgba(139, 92, 246, 0.2);
            border-radius: 16px;
            padding: 25px;
            margin-bottom: 40px;
            position: relative;
        }

        .fingerprint-box label {
            font-size: 12px;
            color: var(--primary);
            text-transform: uppercase;
            letter-spacing: 2px;
            font-weight: 700;
            display: block;
            margin-bottom: 12px;
        }

        .fingerprint-value {
            font-family: 'JetBrains Mono', monospace;
            font-size: 15px;
            word-break: break-all;
            color: #fff;
            line-height: 1.6;
            text-shadow: 0 0 20px var(--accent-glow);
        }

        .meta-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 25px;
        }

        .meta-item {
            border-bottom: 1px solid rgba(255,255,255,0.05);
            padding-bottom: 10px;
        }

        .meta-item label {
            font-size: 11px;
            color: var(--muted);
            text-transform: uppercase;
            letter-spacing: 1px;
            display: block;
            margin-bottom: 4px;
        }

        .meta-item value {
            font-size: 16px;
            font-weight: 600;
            color: #f1f5f9;
        }

        footer {
            margin-top: 60px;
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
            padding-top: 30px;
            border-top: 1px solid rgba(255,255,255,0.05);
        }

        .timestamp {
            font-size: 12px;
            color: var(--muted);
        }

        .signature {
            text-align: right;
        }

        .signature p {
            font-size: 12px;
            color: var(--muted);
            margin-bottom: 8px;
        }

        .signature .stamp {
            font-family: 'JetBrains Mono', monospace;
            font-weight: 800;
            color: var(--primary);
            font-size: 18px;
            letter-spacing: -1px;
        }

        @media print {
            body { background: white !important; padding: 0; }
            .certificate { 
                box-shadow: none !important; 
                border: 1px solid #eee !important;
                background: white !important; 
                color: black !important;
            }
            .brand p { -webkit-text-fill-color: black !important; }
            .fingerprint-value { color: black !important; text-shadow: none !important; }
            .qr-code { border: 1px solid #ddd; }
            .fingerprint-box { background: #f8fafc !important; border: 1px solid #e2e8f0 !important; }
            .meta-item value { color: black !important; }
        }
    </style>
</head>
<body>
    <div class="certificate">
        <header>
            <div class="brand">
                <h1>Universal Music Registry</h1>
                <p>Digital Footprint Certificate</p>
            </div>
            <div class="cert-number">REF No. ${hash.substring(0, 12).toUpperCase()}</div>
        </header>

        <div class="main-content">
            <div class="sidebar">
                ${coverArtHtml}
                <div class="qr-section">
                    <div class="qr-code">
                        <img src="${qrCodeUrl}" alt="Verification QR">
                    </div>
                    <div class="qr-text">
                        <h4>Verify Authenticity</h4>
                        <p>Scan to verify file hash against the blockchain-anchored global registry.</p>
                    </div>
                </div>
            </div>

            <div class="details">
                <div class="fingerprint-box">
                    <label>Persistent Digital Fingerprint (SHA-256)</label>
                    <div class="fingerprint-value">${hash}</div>
                </div>

                <div class="meta-grid">
                    <div class="meta-item">
                        <label>Track Title</label>
                        <value>${metadata.title || fileName}</value>
                    </div>
                    <div class="meta-item">
                        <label>Primary Artist</label>
                        <value>${metadata.artist || 'Independent'}</value>
                    </div>
                    <div class="meta-item">
                        <label>Genre / Style</label>
                        <value>${metadata.mainGenre || 'Alternative'}</value>
                    </div>
                    <div class="meta-item">
                        <label>Release Date</label>
                        <value>${metadata.year || new Date().getFullYear()}</value>
                    </div>
                    <div class="meta-item">
                        <label>Tempo (BPM)</label>
                        <value>${metadata.bpm || '--'}</value>
                    </div>
                    <div class="meta-item">
                        <label>Musical Key</label>
                        <value>${(metadata.key || '') + ' ' + (metadata.mode || '')}</value>
                    </div>
                    <div class="meta-item">
                        <label>ISRC Code</label>
                        <value>${metadata.isrc || 'Pending Registration'}</value>
                    </div>
                    <div class="meta-item">
                        <label>Copyright Holder</label>
                        <value>${metadata.copyright || 'Copyright Owned by Creator'}</value>
                    </div>
                </div>
            </div>
        </div>

        <footer>
            <div class="timestamp">
                Certified on ${date}<br>
                Music Metadata Engine v1.4.0 • Enterprise Standards
            </div>
            <div class="signature">
                <p>AUTHORITY STAMP</p>
                <div class="stamp">METADATA ENGINE</div>
            </div>
        </footer>
    </div>
</body>
</html>
    `;
};
