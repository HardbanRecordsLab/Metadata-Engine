# Developer API

Programmatic access to the analysis pipeline. Same engine as the web app.

- **Base URL:** `https://metadata.hardbanrecordslab.online/api`
- **Auth:** an `X-API-Key` header. Each user has one key — see it (and rotate
  it) in the app under **Settings → Security**. The key resolves to that user
  account: analyses **cost 1 credit each**, exactly like the UI, and free
  credits / packs / redeem codes all apply.
- **Interactive reference:** `GET /api/docs` (FastAPI / OpenAPI).

Everything the web app can do that goes through `get_user_and_check_quota`
also accepts `X-API-Key` — you are not limited to the endpoints below.

## Analyse a track (async)

Analysis is asynchronous: submit, then poll.

### 1. Submit

```
POST /api/analysis/generate
X-API-Key: <key>
Content-Type: multipart/form-data
```

| Field | | Default | Notes |
|---|---|---|---|
| `file` | file | — | MP3 / WAV / FLAC / M4A / AAC / OGG, ≤ 100 MB |
| `model_preference` | text | `flash` | `flash` = 2-model vote, `pro` = 3-model vote |
| `transcribe` | text | `true` | attempt lyrics transcription |
| `is_fresh` | text | `false` | force the "unknown track" analyzer |

```bash
curl -X POST https://metadata.hardbanrecordslab.online/api/analysis/generate \
  -H "X-API-Key: $MME_KEY" \
  -F "file=@track.wav" \
  -F "model_preference=pro"
```

Response: `{ "job_id": "<uuid>", ... }`

### 2. Poll

```
GET /api/analysis/job/{job_id}
X-API-Key: <key>
```

```json
{
  "id": "<uuid>",
  "status": "pending | processing | completed | error",
  "file_name": "track.wav",
  "message": "…",
  "result": { /* present when status == completed */ },
  "error":  "…"        /* present when status == error */
}
```

The `result` object carries `mainGenre`, `additionalGenres`, `moods`,
`instrumentation`, `vocalStyle`, `keywords`, `useCases`, `trackDescription`,
`energyLevel`, `musicalEra`, `similar_artists`, `confidence`, plus the DSP
block (tempo, key, loudness, spectral profile) and the SHA-256 Authenticity
DNA.

## Exports

Once a job is `completed`, format it for delivery:

| Endpoint | Output |
|---|---|
| `GET /api/export/csv/{job_id}` | MP3Tag CSV |
| `GET /api/export/json/{job_id}` | full JSON |
| `GET /api/export/ddex/{job_id}` | DDEX ERN 4.3 XML |
| `GET /api/export/cwr/{job_id}` | CWR 2.1 |

## Errors & limits

| Code | Meaning |
|---|---|
| `401` | missing / unknown API key |
| `402` | out of credits — buy a pack or redeem a code |
| `400` | unsupported file type or malformed request |
| `404` | unknown `job_id` |
| `429` | rate limited (IP-based today; per-key limits are a planned addition) |

## Roadmap

Per-key rate tiers, delivery webhooks (instead of polling), and a versioned
`/api/v1/` namespace are planned for the partner tier. Contact
`contact@hardbanrecordslab.online` for a DPA or higher throughput.
