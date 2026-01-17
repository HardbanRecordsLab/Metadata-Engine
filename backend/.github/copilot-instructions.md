# Copilot Instructions for Music Metadata Engine Backend

This workspace is for the FastAPI backend of Music Metadata Engine. Follow these steps for implementation:

1. Scaffold FastAPI project structure in the root directory.
2. Implement secure API endpoints for:
   - Proxying requests to external services (Gemini, Spotify, Last.fm, etc.) using server-side secrets
   - User authentication (Supabase Auth or similar)
   - Storing analysis history and user preferences in a cloud database (Firestore or PostgreSQL)
   - Quota management for API usage
   - Batch audio analysis, tagging, and DDEX export
3. Ensure backend is ready for integration with React/Vite frontend.
4. Support future extensions for ML/audio processing.
5. Keep documentation and README up to date.

Work through each checklist item systematically and mark as completed when done.
