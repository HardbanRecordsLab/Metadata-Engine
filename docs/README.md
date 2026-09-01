# Metadata Engine — Documentation

Metadata Engine turns a raw audio file into professional, distribution-ready
metadata: DSP measurements (BPM, key, loudness, spectral profile), a
multi-model AI classification (genre, mood, instrumentation, vocal style, a
written description), identification against public databases, and exports in
the formats DSPs and PROs accept (DDEX ERN 4.3, CWR 2.1, MP3Tag CSV, JSON).
It also issues a signed **Certificate of Authenticity** pinned to IPFS.

Operated by **HardbanRecords Lab** (Poland, EU). App:
`https://app-metadata.hardbanrecordslab.online`.

## Contents

| Document | Audience | Covers |
|---|---|---|
| [BUSINESS.md](BUSINESS.md) | Founders, partners, investors | The metadata problem, target users, competitive position, pricing, revenue model, roadmap |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Engineers | The real system — services, the LLM consensus ensemble, exports, certificates, deploy topology |
| [USER-GUIDE.md](USER-GUIDE.md) | End users | Signing up, credits, analysing a track, reading the result cards, exports, certificates, batch, settings |
| [LEGAL-OVERVIEW.md](LEGAL-OVERVIEW.md) | Everyone | Plain-language map of the binding legal documents shown in the app |
| [OPERATIONS.md](OPERATIONS.md) | Whoever runs the deploy | Env vars, GitHub Secrets, the deploy pipeline, the VPS, admin, backups |
| [SEO.md](SEO.md) | Whoever maintains the site | Canonical domain, meta/JSON-LD strategy, sitemap upkeep |

`archive/` holds one-off scripts kept only for history.

## Source of truth

- **Legal:** the text rendered by `frontend/components/LegalModal.tsx` is
  binding. `LEGAL-OVERVIEW.md` only summarises it.
- **Env / secrets:** `backend/.env.example` lists every variable;
  GitHub repo Secrets is what the deploy actually reads.
- **Code:** where a doc and the code disagree, the code wins — open an issue
  to fix the doc.
