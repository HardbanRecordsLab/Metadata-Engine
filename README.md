---
title: Music Metadata Engine
emoji: 🎵
colorFrom: indigo
colorTo: purple
sdk: docker
app_port: 7860
pinned: false
license: other
---

# 🎵 Music Metadata Engine: Professional Edition

**AI-Powered Audio Analysis & Metadata Enrichment Platform**

A comprehensive music metadata extraction and enrichment system that combines DSP audio analysis (Essentia/Librosa) with AI-powered classification (Gemini 2.0), delivering professional-grade metadata for music production, distribution, and licensing.

---

## ✨ Features

### 🔬 **Core Analysis**
- **BPM Detection**: Precise tempo analysis using Essentia RhythmExtractor
- **Key Detection**: Chromatic key & mode detection (12-tone + major/minor)
- **Audio Metrics**: LUFS loudness, danceability, energy level
- **SHA-256 Fingerprinting**: File integrity verification

### 🤖 **AI Enrichment** (Gemini 2.0 Flash)
- **Genre Classification**: Main + additional genres with confidence scores
- **Mood & Vibe**: Context-aware emotional classification
- **Instrumentation Detection**: AI-identified instruments from audio signature
- **Use Case Tagging**: Commercial sync licensing categories
- **Vocal Style Analysis**: Gender, timbre, delivery, emotional tone

### 📦 **Export Formats**
- **CSV (MP3Tag)**: Bulk import compatible with MP3Tag software
- **JSON**: Full metadata structure with ISO timestamps
- **DDEX ERN 4.3**: XML for professional music distribution (Spotify, Apple Music)
- **CWR V2.1**: Common Works Registration for PRO (ASCAP, BMI, GEMA)

### 🌐 **IPFS Certificate**
- **JSON-based certificate** uploaded to Pinata (IPFS)
- **PDF-style viewer** with legal disclaimer & verification URL
- **Cryptographic proof** of file existence (SHA-256 hash)
- **Berne Convention** compliant for "Prior Art" claims

### 🚀 **Advanced Features**
- **Batch Processing**: Concurrent analysis of multiple files (3x faster)
- **AI Cover Art Generator**: Pollinations.ai with gradient fallback
- **Premium UI/UX**: Glassmorphic design with dark mode

---

## 🎯 Use Cases

- **Music Producers**: Accurate BPM/key for mixing & DJing
- **Labels & Distributors**: DDEX-compliant metadata for global distribution
- **Sync Licensing**: Mood/use case tagging for music supervisors
- **Copyright Protection**: IPFS certificates for proof of existence
- **PRO Registration**: CWR exports for royalty collection

---

## 🛠️ Technology Stack

**Backend**:
- FastAPI (Python 3.10)
- Essentia (DSP audio analysis)
- Librosa (fallback DSP)
- Gemini 2.0 Flash Experimental (AI enrichment)
- Mutagen (metadata tagging)

**Frontend**:
- React 19.2
- TypeScript 5.2
- Vite 5.2
- Tailwind CSS 3.4

**Infrastructure**:
- Hugging Face Spaces (Docker)
- Pinata (IPFS storage)
- SQLite (job queue)

---

## 🚀 Quick Start

1. **Upload** an audio file (.mp3, .wav, .flac)
2. **Analyze** - wait 30-45 seconds for DSP + AI processing
3. **Review** metadata across 5 result cards
4. **Export** in your preferred format (CSV/JSON/DDEX/CWR)
5. **Protect** your work with IPFS certificate

---

## 📊 API Endpoints

### Analysis
- `POST /analyze` - Full track analysis (DSP + AI)
- `POST /mir/analyze` - MIR-only analysis
- `POST /mir/batch_analyze` - Batch processing

### Export
- `GET /export/csv/{job_id}` - MP3Tag CSV
- `GET /export/json/{job_id}` - Full JSON
- `GET /export/ddex/{job_id}` - DDEX ERN 4.3 XML
- `GET /export/cwr/{job_id}` - CWR V2.1

### Generative
- `POST /generate/cover` - AI cover art
- `POST /generate/hash` - SHA-256 hash
- `POST /generate/certificate` - IPFS certificate

### Tagging
- `POST /tag/mp3` - ID3 tagging
- `POST /tag/flac` - FLAC tagging

Full API documentation: `/docs` (FastAPI Swagger)

---

## 🔐 Environment Variables

Required for full functionality:

```bash
GEMINI_API_KEY=your_gemini_key
PINATA_JWT=your_pinata_jwt
PINATA_GATEWAY=https://gateway.pinata.cloud/ipfs/
```

Optional (enrichment):
```bash
GROQ_API_KEY=your_groq_key  # AI fallback
SPOTIFY_CLIENT_ID=your_spotify_id
LASTFM_API_KEY=your_lastfm_key
```

---

## 📈 Performance

- **Analysis Speed**: 30-45 seconds per track (3-5 min duration)
- **Batch Processing**: 3x faster with concurrent queue (3 parallel jobs)
- **Supported Formats**: MP3, WAV, FLAC (up to 100MB)

---

## 📄 License

Proprietary License - © 2026 HardbanRecords Lab. All Rights Reserved.
Commercial use without prior authorization is strictly prohibited.

---

## 🙏 Acknowledgments

Built with:
- [Essentia](https://essentia.upf.edu/) - Audio analysis framework
- [Librosa](https://librosa.org/) - Audio DSP library
- [Gemini 2.0](https://deepmind.google/technologies/gemini/) - Google's AI model
- [Pinata](https://pinata.cloud/) - IPFS pinning service

---

## 📞 Support

For issues, feature requests, or questions:
- Open an issue on GitHub
- Contact: hardbanrecords@proton.me

---

**Version**: 2.1.0  
**Status**: Production Ready ✅  
**Last Updated**: January 2026
