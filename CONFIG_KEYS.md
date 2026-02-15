# Konfiguracja kluczy i ustawień – Frontend (Vercel) / Backend (VPS)

Poniżej kompletna lista wymaganych i opcjonalnych kluczy oraz ustawień dla poprawnego działania aplikacji. Dla każdego elementu podano:
- Co to jest i do czego służy
- Skąd to wziąć
- Gdzie to zapisać (Front/Back)

## Frontend (Vercel)
- VITE_API_URL (opcjonalne)
  - Cel: jawne ustawienie adresu API, jeśli nie chcesz używać `rewrites` z `vercel.json`
  - Skąd: własna domena backendu (HTTPS), np. `https://metadata.hardbanrecordslab.online/api`
  - Gdzie: Vercel → Project → Settings → Environment Variables (Value: URL)
  - Uwaga: obecnie `frontend/vercel.json` już proxy’uje `/api/*` na VPS; ustawienie VITE_API_URL nie jest wymagane.

## Backend (VPS) – plik `.env` (produkcja)
Zapisz w: `/srv/hbrl/Metadata-Engine/.env` lub w `docker-compose` jako environment. W repo przykładowa konfiguracja: `.env.production`. Nie commituj haseł.

- DATABASE_URL
  - Cel: połączenie z centralną bazą Postgres
  - Skąd: Twoja instancja Postgres (na sieci docker: `hbrl-postgres`)
  - Przykład: `postgresql://hbrl_admin:<hasło>@hbrl-postgres:5432/hbrl_central`
  - Gdzie: `.env` backendu

- LEMONSQUEEZY_WEBHOOK_SECRET
  - Cel: weryfikacja podpisu webhooków Lemon Squeezy
  - Skąd: Lemon Squeezy → Store Settings → Webhooks
  - Gdzie: `.env` backendu

- PINATA_JWT
  - Cel: autoryzacja w Pinata (pin JSON/plików)
  - Skąd: Pinata → API Keys (JWT lub Bearer)
  - Gdzie: `.env` backendu

- PINATA_GATEWAY
  - Cel: adres bramki IPFS do wyświetlania zasobów
  - Skąd: własna bramka lub Pinata, np. `https://gateway.pinata.cloud/ipfs/`
  - Gdzie: `.env` backendu

- GROQ_API_KEY
  - Cel: transkrypcja/LLM (Whisper przez Groq)
  - Skąd: Groq Cloud → API Keys
  - Gdzie: `.env` backendu

- GEMINI_API_KEY
  - Cel: wzbogacanie metadanych (LLM)
  - Skąd: Google AI Studio → API keys
  - Gdzie: `.env` backendu

- MISTRAL_API_KEY, DEEPSEEK_API_KEY, XAI_API_KEY (opcjonalne)
  - Cel: dodatkowe modele LLM w zespole (ensemble)
  - Skąd: odpowiednie portale deweloperskie
  - Gdzie: `.env` backendu

- SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET
  - Cel: pobieranie danych/feature’ów utworów ze Spotify
  - Skąd: Spotify for Developers → Dashboard → App
  - Gdzie: `.env` backendu

- LASTFM_API_KEY
  - Cel: dane z Last.fm (biogramy, tagi, podobni artyści)
  - Skąd: Last.fm API → Registration
  - Gdzie: `.env` backendu

- DISCOGS_CONSUMER_KEY, DISCOGS_CONSUMER_SECRET (opcjonalne)
  - Cel: integracja z Discogs (wydawnictwa, katalogi)
  - Skąd: Discogs Developer → Generate key
  - Gdzie: `.env` backendu

- ACOUSTID_API_KEY, ACOUSTID_API_TOKEN (opcjonalne)
  - Cel: fingerprint/submit do AcoustID
  - Skąd: AcoustID → Account → Keys/Tokens
  - Gdzie: `.env` backendu

- CORS_ORIGINS
  - Cel: lista dozwolonych originów dla przeglądarki (frontend)
  - Skąd: Twoje domeny, np. `https://app-metadata.hardbanrecordslab.online,https://your-vercel-domain.vercel.app`
  - Gdzie: `.env` backendu

## Infrastruktura i zależności
- FFmpeg (z chromaprint)
  - Cel: konwersja, strip-metadanych, fingerprint
  - Instalacja: na VPS (apt/dnf) lub w obrazie Dockera. Wymagana kompilacja z `chromaprint` dla fingerprintu.

- Nginx reverse proxy
  - Cel: wystawienie `https://metadata.hardbanrecordslab.online/api` → `localhost:8888`
  - Skąd: konfiguracja Nginx na VPS (certyfikaty SSL, proxy_pass)
  - Gdzie: `/etc/nginx/sites-available/...`

- Vercel `vercel.json` (frontend)
  - Cel: proxy `/api/*` na VPS backend
  - Gdzie: `frontend/vercel.json` (już skonfigurowane)

## Uprawnienia administratora
- Admin w aplikacji:
  - Źródło: pole `is_superuser` w tabeli `users` (DB) oraz zwracane przez `/api/auth/me`
  - Efekt: pełny dostęp do funkcji, kredyty nielimitowane w UI
  - Gdzie: ustaw `is_superuser=true` dla swojego konta w DB (np. przez SQL lub panel)

## Gdzie zapisać
- Frontend (Vercel):
  - Vercel → Project → Settings → Environment Variables (Production/Preview/Development)
  - Nie zapisuj sekretów na froncie; używaj tylko publicznych wartości (np. VITE_API_URL)

- Backend (VPS/Docker):
  - Plik `.env` obok backendu (np. `/srv/hbrl/Metadata-Engine/.env`)
  - Lub `docker-compose.yml` → `environment:` dla kontenera backendu
  - Nie commituj `.env` z sekretami

## Szybki check po wdrożeniu
- `GET https://metadata.hardbanrecordslab.online/api/` → zdrowie backendu
- `POST /api/tools/strip-metadata` (z plikiem) → powinno zwrócić plik
- `POST /api/tools/convert` (z plikiem + `target_format`) → konwersja OK
- `POST /api/tools/fingerprint` (z plikiem) → zwraca fingerprint
- `POST /api/analysis/transcribe` (z plikiem) → requires `GROQ_API_KEY`
- `POST /api/webhook/lemonsqueezy` → signinatura OK przy realnym webhooku
