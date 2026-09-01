# User Guide

App: `https://app-metadata.hardbanrecordslab.online`

## 1. Account & credits

1. Open the app, choose **Sign Up**, register with email + password (or
   Google).
2. New accounts get **3 free credits**. **1 credit = 1 full analysis.**
   Exporting the results of an analysis you already ran is free.
3. Out of credits? **Settings → Buy credits** → pick a pack → Stripe Checkout.
   Credits appear as soon as the payment confirms (you're redirected back with
   `?billing=success`).
4. Have a promo/referral code? **Settings → Redeem code**.

## 2. Analyse a track

1. From the dashboard, **New Analysis** (or drag a file onto the dropzone).
2. Supported: MP3, WAV, FLAC, AIFF — up to ~100 MB.
3. Choose the mode:
   - **Flash** — faster, 2-model AI consensus.
   - **Pro** — adds a third independent model for a genuine 3-way vote.
4. Watch progress in real time; the written description streams in as it's
   generated.
5. A run takes roughly 20–45 s depending on mode and track length.

## 3. Read the results

Results are grouped into cards:

| Card | What it shows |
|---|---|
| **Track Identity** | Title, artist, detected language, era/production style |
| **Sonic Analysis** | BPM, key/mode, energy, loudness (LUFS), brightness, dynamics, spectral profile |
| **Classification & Style** | Main genre, sub-genres, moods, instrumentation, vocal style — each with a **confidence meter** |
| **Structure** | Section/arrangement read from the signal |
| **Identification** | Matches from ACRCloud / AcoustID / MusicBrainz (if the recording is known) |
| **External Data** | Spotify / Last.fm / Discogs enrichment |
| **Marketing** | Keywords, use-cases, target audience, similar artists, the prose description |
| **Commercial / Legal** | Sync-placement suggestions and the AI-content caveat |
| **Copyright** | Authenticity DNA (SHA-256), fingerprint |
| **Visuals** | AI cover-art suggestion + colour palette |
| **Validation Report** | Consistency checks (e.g. BPM vs genre) and confidence summary |

Every AI tag has a confidence score. **If you disagree, override it** — the
model's answer is a suggestion, not a verdict (see the AI Disclaimer in the
app footer).

## 4. Export

After an analysis, export in any format — no extra credit:

- **MP3Tag CSV** — bulk import into MP3Tag.
- **JSON** — the full structure with ISO timestamps.
- **DDEX ERN 4.3** — XML for delivery to DSPs via a distributor.
- **CWR 2.1** — Common Works Registration for PRO/CMO submission.

You can also write tags straight back into the audio file (**Tools → Tag**),
strip metadata, or convert format.

## 5. Certificate of Authenticity

Generate a signed certificate (PDF) for a track. It embeds the Authenticity
DNA hash and is **pinned to IPFS**, with a public verification page at
`/verify/<id>` that anyone can check. Useful as a pre-distribution provenance
record.

## 6. Batch

**Batch Processor** analyses many files at once (a queue with a few parallel
jobs). Each file still costs 1 credit. Good for auditing an album or a
back catalogue.

## 7. History & settings

- **History** — every past analysis, re-openable and re-exportable.
- **Settings** — profile, credits & purchases, redeem codes, theme
  (light/dark).

## 8. Verifying someone else's certificate

Open `/verify/<certificate_id>`. The page shows the certified metadata, the
Authenticity DNA, the IPFS link, and whether the hash still matches — no
account needed.

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| "Zaloguj się, aby skorzystać" | Not signed in. |
| "Brak kredytów" (HTTP 402) | Out of credits — buy a pack or redeem a code. |
| Genre comes back generic / "Pop" fallback | Too few AI models answered; the DSP-only fallback ran. Retry, or use Pro mode. |
| Identification card empty | The recording isn't in the public databases — normal for unreleased tracks. |
| Analysis stuck | Refresh; the job is in the queue and will still complete server-side. |
