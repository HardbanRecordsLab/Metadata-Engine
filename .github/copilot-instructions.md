# AI Coding Agent Instructions for Music Metadata Engine

## Project Overview
This is a full-stack music metadata analysis application with FastAPI backend (Python) and React frontend (TypeScript). It analyzes audio files for BPM, key, genre, moods, and more using AI (Groq) and DSP libraries (Librosa). Supports batch processing, user auth via Supabase, and metadata tagging.

## Architecture
- **Backend**: FastAPI with async job-based analysis (see `backend/app/routes/analysis.py`). Uses background tasks for processing; jobs stored in SQLite via SQLAlchemy.
- **Frontend**: React with Vite, lazy-loaded components, Supabase auth context.
- **Data Flow**: File upload → Job creation → Background analysis → Results stored in DB → Frontend polls for status.
- **External APIs**: Proxied through backend (Spotify, Last.fm, Discogs) to avoid CORS and secure API keys.

## Key Patterns
- **Metadata Schema**: Strict validation in `analysis.py` `sanitize_metadata()` - only allowed keys like `title`, `artist`, `bpm`, `key`, `moods` (array), `vocalStyle` (dict). Deprecate old fields like `STRUCTURE`.
- **Async Processing**: Use `BackgroundTasks` for analysis; return `job_id` immediately. Frontend polls `/analysis/job/{job_id}`. WebSocket at `/analysis/ws/{job_id}` for real-time progress updates.
- **Caching**: SHA-256 fingerprint for caching analysis results to avoid re-processing identical files.
- **Validation**: `MetadataValidator` for cross-checking metadata consistency.
- **Pipelines**: Standard Groq pipeline vs Fresh Track Analyzer (high accuracy mode).
- **Quota/Auth**: All analysis routes depend on `get_user_and_check_quota` (see `dependencies.py`). Bypass credit checks in dev (commented out in `App.tsx`).
- **File Handling**: Uploads to `uploads/` dir; clean up temp files. Use multipart limits patched in `main.py` (100MB).
- **Error Handling**: Raise `HTTPException` with descriptive messages; log with `logger`.
- **DB Models**: Use SQLAlchemy ORM; sessions via `get_db()` dependency.

## Development Workflow
- **Run Locally**: `npm run start` (root) runs both frontend (5173) and backend (8080) concurrently.
- **Docker Dev**: `docker-compose up -d --build` for full environment with volumes.
- **Testing**: Backend uses pytest (`pytest.ini`); frontend Vitest. Run `npm test` in frontend.
- **Linting**: Ruff for Python, ESLint for TSX. Run `ruff check .` and `npm run lint`.
- **Build**: Frontend `npm run build`; backend packaged in Docker.

## Conventions
- **Imports**: Absolute from `app.` in backend; relative in frontend.
- **Types**: Pydantic models in `types.py`; TypeScript interfaces in `types.ts`.
- **Services**: Backend services in `app/services/` (e.g., `groq_whisper.py` for AI pipeline).
- **Components**: React components in `components/`, lazy-loaded for performance.
- **Environment**: `.env` files for API keys; Supabase config in `supabase_client.py/ts`.
- **Commits**: Feature branches; update README/docs for changes.

## Common Tasks
- **Add Analysis Feature**: Extend `ALLOWED_METADATA_KEYS`, update `sanitize_metadata()`, add to AI prompt in `groq_whisper.py`.
- **New Route**: Add router in `routes/`, include in `main.py` `app.include_router()`.
- **Frontend State**: Use `AuthContext` for user; batch state in `App.tsx`.
- **Debug**: Check logs in Docker (`docker-compose logs`); use `/debug/limits` for upload issues.

Reference: `backend/README.md`, `docs/DOCKER_GUIDE.md`, `frontend/package.json`.</content>
<parameter name="filePath">e:\Music-Metadata-Engine\.github\copilot-instructions.md