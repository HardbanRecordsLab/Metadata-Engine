# backend/scripts

Local, manual dev/CLI helpers. **Nothing here runs in CI or at deploy time** —
`entrypoint.sh` starts only `uvicorn app.main:app`. Run these from the
`backend/` directory (`python scripts/<name>.py ...`).

| Script | Purpose |
|---|---|
| `run_local_analysis.py <audio> [--fast] [--groq]` | Run the full analysis pipeline on one local file, print JSON. Fastest way to eyeball a real result. |
| `quick_core.py <audio>` | Minimal librosa core features (tempo, key) — sanity check without the full stack. |
| `compute_bpm_key_embed.py <audio>` | BPM + key + embedding vector for one file. |
| `compute_and_embed_dsp.py <audio>` | Fast DSP feature set on a short excerpt (responsiveness test). |
| `read_tags.py <audio>` | Dump existing ID3/Vorbis tags via tinytag. |
| `dump_all_tags.py <audio>` | Exhaustive tag dump via mutagen (all formats). |
| `apply_tags.py <audio> <json>` | Write a metadata JSON back into an audio file's tags. |
| `generate_certificate_local.py` | Render a certificate PDF/HTML into the workspace for local preview (no server). |
| `validate_industry_exports.py` | Validate generated CWR 2.1 / DDEX ERN 4.3 output against the real spec structure — deeper than the `tests/` unit checks. Run after touching `services/cwr_*` or `services/ddex_*`. |
