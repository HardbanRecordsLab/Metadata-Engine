# Metadata Engine 3.0

Version 3.0 changes what the engine *is*: it no longer infers a track from DSP numbers alone. It listens to it, measures it,
checks every claim against independent evidence, and signs the result.

| Layer | What it does | Module |
|---|---|---|
| **Hearing** | LAION CLAP audio-language model (`laion/clap-htsat-unfused`, CPU) embeds the audio and compares it with text prompts: genre (40 labels), mood, instruments and *is there a singer, male or female*. Also yields a 512-d **sonic vector** for similarity / duplicate detection. Vocal prompts and thresholds were calibrated on 22 reference tracks (96 % balanced accuracy). | `services/hearing.py` |
| **Tempo consensus** | Essentia multifeature + degara + Percival + a sub-frame refined librosa beat track, folded into one pulse class. The old single librosa value was quantised to ~23 ms frames (117.5 / 99.4 / 143.6 …, up to ±3 % off) and confused octaves (95.7 vs 143.6). Reports agreement and alternatives. | `services/tempo.py` |
| **Genre grounding** | File name + caller `context` become genre hints; a guard rewrites an organic genre (soul/jazz/R&B…) when context, rhythm or *what the model hears* says it is a different family. Every correction is recorded in `genreCorrected`. | `services/genre_guard.py` |
| **Trust layer** | Per-field evidence (genre, vocals, tempo, energy): which sources said what, agreement, confidence, review flags (`genre:llm_vs_hearing`, `vocals:…_vs_owner`, `tempo:estimators_disagree` …) and an A–D grade + `needsReview`. | `services/trust.py` |
| **Technical QC / sync-readiness** | EBU R128 loudness + true peak, clipping, head/tail silence, ending style, and the **lossy-origin test** (a WAV/FLAC brick-walled at 16–20 kHz was decoded from MP3/AAC and is not a master). Score and checklist. | `services/qc.py` |
| **Smart cutdowns** | 15/30/60 s edits on bar/phrase lines from the consensus beat grid: an *intro* cut and a *hook* cut per length, with a musical fade-out; can be rendered. | `services/cutdowns.py` |
| **Metadata Passport** | Ed25519-signed statement binding the audio SHA-256 to the key claims, the trust grade and the engine version. Editing one claim breaks the signature; anyone with the public key can verify. | `services/passport.py` |

## API

`POST /api/analysis/generate` — new optional form fields:

* `context` — free text about the track ("Instrumental DJ's Vol. 2, club tracks"), authoritative for genre.
* `instrumental` — `auto` (default) | `true` | `false`. `auto` lets the hearing model decide when it is ≥ 80 % sure.

Result gains: `hearing`, `sonicVector`, `trust`, `tempoAnalysis`, `syncReadiness`, `technical`, `passport`, and
`genreCorrected` when the guard acted.

New endpoints (`/api/intelligence/…`):

| Endpoint | Purpose |
|---|---|
| `POST /qc` | technical QC + sync-readiness for a file |
| `POST /cutdowns` (`targets=15,30,60`) | cutdown proposals |
| `POST /cutdowns/render` (`start,end,fade_out,format`) | render one proposal |
| `POST /hear` (`vector=true` optional) | what the audio model hears |
| `POST /similar` | rank sonic vectors by cosine (≥ 0.97 ≈ same recording / another master) |
| `GET /passport/public-key`, `POST /passport/verify` | verify a passport offline-style |
| `POST /embed-text` (public, 120/min) | free text -> CLAP vector in the same space as a track's `sonicVector` |
| `POST /semantic-search` | embed a query and cosine-rank candidate vectors (`{query, candidates:[{id,vector}], top}`) |
| `POST /profile` | fast catalogue profile: hearing + tempo consensus, no LLM (seconds per track) |

## Search by sound (Sync Hub)

`/embed-text` turns a scene description ("dark driving techno for a chase scene") into a vector in the audio model's space. The Sync Hub
public library (`GET /api/tracks/public/semantic`) scores every public track's stored `sonicVector` against it and blends the cosine
(80 %) with the old tag/keyword score (20 %). Tracks gain a vector from an Engine 3.0 analysis or from the catalogue back-fill below;
until enough tracks have vectors the endpoint answers 204 and the library behaves as before.

## Catalogue back-fill (bringing an older catalogue to 3.0)

`app/services/catalog_profile.py` profiles a track in seconds (hearing + tempo, no LLM) and `plan_update` decides what to change:
* BPM only when the estimators agree (>= 75 %) and the new value differs by > 1.5 % - and never by an octave (a half/double reading is
  a felt-tempo ambiguity, not an error);
* genre only when the audio model's dominant family holds >= 55 % of the probability and is incompatible with the stored label
  ("Cinematic Neo-Soul" on a 124 BPM techno track becomes "Cinematic Techno");
* `hasVocals` / vocal gender from the calibrated singer detector when it is confident;
* always adds `sonicVector`, the hearing summary and tempo analysis, and keeps the previous genre/BPM in `metadata.engine3.previous`.

## Operations

* The CLAP weights (~600 MB) are cached in `/data/hf` (persistent volume) and loaded in the background at start-up.
  `HEARING_ENABLED=false` switches hearing off; the engine then behaves as before (no hearing, hints only).
* The passport signing key lives in `/data/passport_ed25519.key` (or `PASSPORT_PRIVATE_KEY`, base64 32 bytes). **Back it up**:
  a new key invalidates nothing already issued (the key id is in each passport) but new passports use the new key.
* Hearing + tempo + QC run in worker threads in parallel with the DSP layer; typical extra wall time is small.
* Tests: `backend/tests/test_genre_guard.py`, `backend/tests/test_engine3.py` (no model or audio files needed).

## Known limits (be honest with customers)

* Genre/mood/instrument labels are zero-shot from a general audio-text model: strong on broad families (techno vs jazz vs hip hop),
  weaker on fine sub-genres. The trust layer exists to surface exactly those disagreements.
* Vocal detection thresholds come from a 22-track calibration; the middle band (50–80 % instrumental) is reported as *unclear*.
* A regional language is not detected without the lyrics pass (`transcribe=true`).
