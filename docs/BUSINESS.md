# Business Overview

## The problem

The move from physical to digital distribution multiplied the volume of music
uploaded to streaming platforms, but the tooling for the *descriptive and
administrative data* attached to each recording never scaled with it. When a
track reaches Spotify, Apple Music or YouTube Music it carries tags that were
usually typed by hand — incomplete, inconsistent, or wrong.

Consequences:

- **Discovery loss** — recommendation and editorial systems can't surface a
  track that has no genre, mood, BPM or key.
- **Royalty leakage** — PROs (ASCAP, BMI, GEMA, ZAiKS…) can't allocate money
  for recordings they can't match; it sits in "black box" accounts.
- **Manual cleanup cost** — distributors and labels pay people to normalise
  metadata before delivery.

One curator's "Deep House" is another's "Tech House." The industry has a
*transport* standard (DDEX) but no agreed way to decide *what the data should
say*.

## What Metadata Engine does about it

It analyses the audio signal itself and derives the descriptive data from
measurable features rather than opinion:

- objective DSP metrics (tempo, key, loudness, spectral balance, dynamics);
- a multi-model AI classification that must reach **consensus** across
  independent models before a tag is accepted, each tag carrying a confidence
  score the user can override;
- identification against public databases (AcoustID, MusicBrainz, ACRCloud);
- a SHA-256 **Authenticity DNA** hash of the decoded audio that ties the
  metadata to that exact recording regardless of file format;
- a signed Certificate of Authenticity, pinned to IPFS, publicly verifiable.

## Target users

| Segment | Why they use it |
|---|---|
| **Independent artists & producers** | Get the BPM/key/genre a distributor (DistroKid, CD Baby, TuneCore) expects, without guessing. |
| **Labels & publishers** | Batch-audit a back catalogue for missing descriptors so every asset stays discoverable and royalty-eligible. |
| **Distributors / DSPs** | Verify incoming metadata in the ingestion pipeline; fewer manual reviews, fewer rejected deliveries. |
| **Sync & production-music libraries** | Granular mood / energy / instrumentation tagging so supervisors can actually search the catalogue. |

## Competitive position

- **vs Shazam / SoundHound** — those match a recording to a known fingerprint
  database ("who is this"). Metadata Engine describes structure ("what is
  this") and works on unreleased material.
- **vs Gracenote** — a centrally curated database vs a signal-first approach
  whose output (the Authenticity DNA + certificate) can live locally or on
  IPFS.
- **vs generative audio models (MusicLM, AudioCraft)** — those create audio;
  the moat here is *standardisation and certification*, not the analysis
  alone.

## Pricing

One-time **credit packs** (no subscription). **1 credit = 1 full analysis**;
exports after an analysis cost nothing extra. New accounts get **3 free
credits**.

| Pack | Credits | Price (USD) |
|---|---|---|
| Starter | 10 | $9 |
| Producer | 50 | $35 |
| Label | 150 | $89 |
| Studio | 400 | $199 |

Payments run through **Stripe**. HardbanRecords Lab is the seller of record
(see [LEGAL-OVERVIEW.md](LEGAL-OVERVIEW.md)). Promo/referral **redeem codes**
grant credits directly.

Implementation detail for operators is in [OPERATIONS.md](OPERATIONS.md);
the billing flow is in [ARCHITECTURE.md](ARCHITECTURE.md#billing).

## Roadmap (direction, not commitments)

- **Near term** — tighten the AI genre taxonomy, faster analysis, redeem/
  referral growth loop.
- **Mid term** — a partner/enterprise API with async batch + webhooks;
  embedding the Authenticity DNA into the audio bitstream (watermarking).
- **Long term** — richer generative descriptions, a verifiable metadata
  ledger, PRO/CMO partnerships around the Authenticity DNA standard.

> The 2026 whitepaper draft (previously `white peper.txt`) described some
> capabilities aspirationally (Kubernetes worker clusters, trained CNN/
> Transformer classifiers, a WooCommerce credit system). The shipping system
> is simpler and is what [ARCHITECTURE.md](ARCHITECTURE.md) documents.
