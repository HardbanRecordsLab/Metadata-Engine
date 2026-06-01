# Plan wdrożenia Metadata-Engine do 100% gotowości produkcyjnej

**Wersja planu:** 2026-05-31  
**Repozytorium:** `G:/VPS HardbanRecordsLab/Apps/Metadata-Engine`  
**Architektura (kanoniczna):** Frontend → Vercel (`app-metadata.hardbanrecordslab.online`) | Backend → VPS Docker (`metadata.hardbanrecordslab.online`, port **8888** → kontener **7860**)  
**Źródła prawdy:** `CONFIG_KEYS.md`, `HRL_Unified_Bible_2026.md` (ścieżki/domeny), `vps.docker-compose.yml`, `.github/workflows/deploy.yml`

> **Uwaga:** `FINAL_VERIFICATION_REPORT.md` (luty 2026) deklaruje 100% — traktuj go jako **nieaktualny**. Ten plan zastępuje go operacyjnie do czasu Fazy 9.

---

## Status wdrożenia

| Pole | Wartość |
|------|---------|
| **Faza 0** | Zakończona **2026-05-31** |
| **Faza 1** | **Zakończona lokalnie 2026-06-01** — commit+push deploy fixes; VPS pull+rebuild w tej sesji |
| **Faza 3** | Rebuild `metadata-backend` po push (2026-06-01) |
| **Faza 4** | AuthContext + `frontend/vercel.json` w repo — **Vercel Production redeploy ręczny** (brak tokenu CI) |
| **Faza 6** | `/api` mount: export, tools, ddex, cwr; diagnose → ACOUSTID_* |
| **Lokalny HEAD** | (po commit) push `main` |
| **VPS HEAD** | sync z `origin/main` po `git pull` |
| **Kontener** | `metadata-backend` — restart po rebuild |
| **Health** | `/api/health/` 200; `/api/health/diagnose` 200 po fix |
| **Backup VPS** | `/srv/hbrl/backups/metadata-engine-2026-05-31-201144.tar.gz` |
| **Następny krok** | Faza 5 SSL/nginx smoke; Faza 7 testy E2E; redeploy Vercel |
---

## Cel i definicja „100%”

### Cel biznesowy
Użytkownik na `https://app-metadata.hardbanrecordslab.online` może **zarejestrować się, zalogować, przeanalizować utwór, wyeksportować metadane (CSV/JSON/DDEX/CWR), użyć narzędzi (strip/convert/fingerprint)** bez błędów 4xx/5xx na ścieżkach krytycznych, z działającym backendem na VPS i automatycznym deployem z GitHub.

### Definicja „100% gotowości produkcyjnej” (kryteria akceptacji)

| Obszar | Kryterium „OK” |
|--------|----------------|
| **Kod** | Lokalne repo = `origin/main` = commit na VPS w `/srv/hbrl/Metadata-Engine` (brak „wiszących” zmian bez opisu) |
| **Backend** | Kontener `metadata-backend` healthy; `GET /api/health/` → `{"status":"ok"}`; `GET /api/health` → `healthy` |
| **Auth** | Login admina (`hardbanrecordslab.pl@gmail.com`) → 200 + token; `GET /api/auth/me` z Bearer → profil |
| **Export** | `GET /auth/export/csv/{jobId}` **lub** poprawione proxy frontend → **200** (nie 404) |
| **Diagnose** | `GET /api/health/diagnose` → **200** JSON (bez 500) |
| **Frontend** | Vercel Production zaktualizowany po fixach `apiConfig` / ścieżek |
| **Secrets** | `.env` na VPS z kluczami z `CONFIG_KEYS.md` / GitHub Secrets (bez commitowania) |
| **Dane** | SQLite prod (`./data/music_metadata.db`) zbackupowany; kolumna `last_login` istnieje |
| **Dokumentacja** | `FINAL_VERIFICATION_REPORT.md` odzwierciedla rzeczywisty stan po testach |

**Świadomie poza „100%” (znane ograniczenia do backlogu):**
- `POST /api/batch/analyze` — stub (dummy results)
- DDEX: domyślne **180 s** w `ddex_orchestrator.py` jeśli brak duration w metadanych
- CWR: placeholder **WRITER001** w `cwr_gen.py`
- Pełna integracja SSO WordPress ↔ Metadata (osobny wątek ekosystemu HRL)

---

## Mapa techniczna (skrót)

```
Użytkownik → app-metadata.hardbanrecordslab.online (Vercel)
              └─ rewrite /api/* → https://metadata.hardbanrecordslab.online/api/*
Nginx (VPS) → 127.0.0.1:8888 → Docker metadata-backend:7860
Baza prod:   sqlite:////data/music_metadata.db (volume ./data)
Deploy CI:   push main → SSH VPS → git pull → docker compose -f vps.docker-compose.yml
```

**Rozjazd routingu (zweryfikowany w repo):**
- Routery `export`, `tools`, `ddex`, `cwr`, część `analysis` → prefix **`/auth`** w `backend/app/main.py`
- Frontend woła m.in. `/api/export/*`, `/api/tools/*` przez `getFullUrl()` → **404** na produkcji
- `GET /api/health/diagnose` odwołuje się do `settings.AUDD_API_TOKEN`, którego **nie ma** w `backend/app/config.py` → **AttributeError → 500**

---

## Faza 0: Przygotowanie (backup, inwentaryzacja)

**Czas:** ~1–2 h  
**Cel:** Wiedzieć, co jest na VPS, zanim cokolwiek nadpiszesz.

### 0.1 Inwentaryzacja lokalna

- [ ] **CO:** Sprawdź branch, zmiany lokalne, zgodność z GitHub.  
  **DLACZEGO:** Git lokalny i VPS mogą być rozjechane.  
  **JAK (lokalnie, PowerShell/Git Bash):**
  ```bash
  cd "G:/VPS HardbanRecordsLab/Apps/Metadata-Engine"
  git status
  git log --oneline -5
  git fetch origin
  git log --oneline origin/main -5
  git diff origin/main --stat
  ```
  **OK gdy:** Wiesz, które commity idą na produkcję i czy masz niezacommitowane fixy (auth, deploy, Dockerfile).

- [ ] **CO:** Przeczytaj `CONFIG_KEYS.md` i zrób checklistę brakujących kluczy (bez zapisywania wartości w notatkach publicznych).  
  **OK gdy:** Masz listę „Present / Missing” dla GEMINI, GROQ, SPOTIFY, ACOUSTID, SECRET_KEY, PINATA, LEMONSQUEEZY.

### 0.2 Inwentaryzacja VPS (tylko odczyt)

- [ ] **CO:** Połącz się SSH i zbierz stan (bez restartów na tym etapie).  
  **DLACZEGO:** Unikniesz nadpisania `.env` i bazy bez kopii.  
  **JAK:**
  ```bash
  ssh -i "C:/Users/HRL/.ssh/id_ed25519" root@84.247.162.167
  cd /srv/hbrl/Metadata-Engine
  git status
  git log --oneline -5
  docker ps --filter name=metadata-backend
  docker compose -f vps.docker-compose.yml ps
  ls -la data/ logs/ temp_uploads/
  test -f .env && echo ".env exists" || echo ".env MISSING"
  curl -sS http://127.0.0.1:8888/api/health/ | head
  curl -sS -o /dev/null -w "%{http_code}" http://127.0.0.1:8888/api/health/diagnose
  ```
  **OK gdy:** Zapiszesz: hash commita VPS, status kontenera, kody HTTP health/diagnose, rozmiar `data/music_metadata.db`.

### 0.3 Backup krytycznych danych

- [ ] **CO:** Kopia bazy SQLite, `.env`, katalogu `data/`.  
  **DLACZEGO:** Rollback bez utraty użytkowników i historii analiz.  
  **JAK (na VPS):**
  ```bash
  cd /srv/hbrl/Metadata-Engine
  BACKUP_DIR="/srv/hbrl/backups/metadata-engine-$(date +%F-%H%M%S)"
  mkdir -p "$BACKUP_DIR"
  cp -a data "$BACKUP_DIR/"
  test -f .env && cp .env "$BACKUP_DIR/.env"
  docker compose -f vps.docker-compose.yml logs --tail=500 > "$BACKUP_DIR/container.log"
  tar -czf "$BACKUP_DIR.tar.gz" -C /srv/hbrl/backups "$(basename "$BACKUP_DIR")"
  ls -lh "$BACKUP_DIR.tar.gz"
  ```
  **OK gdy:** Archiwum `.tar.gz` istnieje i ma rozmiar > 0.

- [ ] **CO:** Opcjonalnie pobierz backup na maszynę lokalną (`scp`).  
  **OK gdy:** Masz kopię off-site.

### 0.4 Lista „nie dotykać” (patrz też sekcja na końcu)

- [ ] Potwierdź, że na VPS **nie** będziesz restartować ani przebudowywać: WordPress, `hbrl-postgres`, innych kontenerów PM2 (Access Manager, Sync Hub, itd.), modułów FROZEN (OmniPost, Community).

---

## Faza 1: Synchronizacja kodu Git (local ↔ VPS ↔ GitHub)

**Czas:** ~2–4 h  
**Cel:** Jedna linia historii: zmiany w repo → `main` → VPS = ten sam commit.

### 1.1 Ustalenie strategii (wybierz jedną)

**Opcja A — GitHub jako źródło prawdy (zalecana):**
1. Lokalnie: commit + push na `main` (akcja użytkownika — patrz uwaga poniżej).
2. VPS: `git fetch && git reset --hard origin/main` **tylko po backupie** i po review diff.

**Opcja B — VPS ma unikalne poprawki:**
1. Na VPS: `git diff > /tmp/vps-local.patch`, skopiuj patch lokalnie, zintegruj, potem Opcja A.

- [ ] **CO:** Porównaj pliki krytyczne między lokalnym a VPS: `backend/app/routes/auth.py`, `frontend/contexts/AuthContext.tsx`, `vps.docker-compose.yml`, `Dockerfile`, `.github/workflows/deploy.yml`.  
  **DLACZEGO:** Uncommitted VPS fixes giną przy `reset --hard`.  
  **JAK:**
  ```bash
  # na VPS
  git diff --name-only
  git diff backend/app/routes/auth.py | head -50
  ```
  **OK gdy:** Masz listę plików do scalenia przed resetem.

### 1.2 Scalanie lokalnych zmian do main

- [ ] **CO:** Upewnij się, że fixy (login, `last_login`, deploy workflow) są w jednym commicie na `main`.  
  **DLACZEGO:** CI deploy (`deploy.yml`) uruchamia się na `push` do `main`.  
  **UWAGA:** **Commit/push wykonuje użytkownik** — agent nie commituje bez prośby.  
  **JAK (użytkownik):**
  ```bash
  git checkout main
  git pull origin main
  # review, test lokalny
  git add <pliki>
  git commit -m "fix: auth, deploy, and production routing alignment"
  git push origin main
  ```
  **OK gdy:** GitHub Actions „Deploy to VPS” przechodzi zielono (lub gotowy ręczny deploy z Fazy 3).

### 1.3 Wyrównanie VPS z origin/main

- [ ] **CO:** Po backupie — zsynchronizuj kod na VPS.  
  **DLACZEGO:** Eliminuje „działający kod tylko na serwerze”.  
  **JAK (ostrożnie):**
  ```bash
  cd /srv/hbrl/Metadata-Engine
  git fetch origin
  git log HEAD..origin/main --oneline
  # jeśli brak unikalnych zmian VPS:
  git reset --hard origin/main
  ```
  **OK gdy:** `git rev-parse HEAD` = `git rev-parse origin/main`.

- [ ] **CO:** Jeśli na VPS były lokalne modyfikacje — zachowaj je w patchu **przed** resetem.  
  **OK gdy:** Żadna potrzebna poprawka nie została utracona.

---

## Faza 2: Konfiguracja środowiska (.env, secrets, CONFIG_KEYS)

**Czas:** ~1–2 h  
**Cel:** Spójne zmienne bez wycieku do repo.

### 2.1 GitHub Secrets (dla CI)

- [ ] **CO:** W repozytorium GitHub → Settings → Secrets → Actions — uzupełnij według `.github/workflows/deploy.yml` i `CONFIG_KEYS.md`.  
  **Wymagane m.in.:** `VPS_HOST`, `VPS_USER`, `VPS_PORT`, `VPS_SSH_KEY`, `SECRET_KEY`, `GEMINI_API_KEY`, `GROQ_API_KEY`, `DATABASE_URL`, klucze Spotify/Last.fm/AcoustID/Pinata/LemonSqueezy.  
  **DLACZEGO:** Workflow **nadpisuje cały plik `.env`** na VPS przy każdym deployu z `main`.  
  **OK gdy:** Sekrety istnieją; brak pustych wartości dla kluczy używanych w smoke testach.

### 2.2 Plik `.env` na VPS (produkcja)

- [ ] **CO:** Zweryfikuj `.env` po deployu CI lub utwórz ręcznie z szablonu `.env.production` (jeśli istnieje).  
  **DLACZEGO:** `vps.docker-compose.yml` używa `env_file: .env` + mount `./.env` do kontenera.  
  **Minimalny zestaw (nazwy — wartości w CONFIG_KEYS / Secrets):**
  - `SECRET_KEY` — JWT
  - `GEMINI_API_KEY`, `GROQ_API_KEY`
  - `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, `LASTFM_API_KEY`
  - `ACOUSTID_API` lub `ACOUSTID_API_KEY`, `ACOUSTID_API_TOKEN`
  - `DATABASE_URL=sqlite:////data/music_metadata.db` (zgodnie z compose — **nie** mieszaj z Postgres bez świadomej migracji)
  - `CORS_ORIGINS` — `https://app-metadata.hardbanrecordslab.online`
  - opcjonalnie: `PINATA_JWT`, `LEMONSQUEEZY_WEBHOOK_SECRET`

- [ ] **CO:** Usuń poleganie na hardcoded `SECRET_KEY` w `vps.docker-compose.yml` (linia `environment: - SECRET_KEY=...`).  
  **DLACZEGO:** Sekret w compose to ryzyko wycieku przez `git`.  
  **OK gdy:** Jedynym źródłem `SECRET_KEY` jest `.env` / GitHub Secret.

### 2.3 Zgodność nazw zmiennych

- [ ] **CO:** Upewnij się, że deploy.yml mapuje te same nazwy co `backend/app/config.py` (np. `DISCOGS_API_KEY`, `ACOUSTID_API`, `ACOUSTID_API_TOKEN`).  
  **OK gdy:** `docker exec metadata-backend env | grep -E 'GEMINI|GROQ|ACOUSTID|SECRET' | sed 's/=.*/=***/'` pokazuje zmienne (wartości zamaskowane).

---

## Faza 3: Backend VPS (Docker, DB, migracje, health)

**Czas:** ~2–3 h  
**Cel:** Stabilny kontener z poprawną bazą i healthcheckiem.

### 3.1 Build i uruchomienie

- [ ] **CO:** Rebuild obrazu po zmianach w `Dockerfile` / `backend/app/db.py`.  
  **DLACZEGO:** Migracje w `db.py` (`run_migrations()`) wykonują się przy starcie aplikacji w kontenerze.  
  **JAK:**
  ```bash
  cd /srv/hbrl/Metadata-Engine
  docker compose -f vps.docker-compose.yml down
  docker compose -f vps.docker-compose.yml up -d --build
  docker compose -f vps.docker-compose.yml ps
  docker logs metadata-backend --tail=100
  ```
  **OK gdy:** Status `healthy` (healthcheck: `curl http://localhost:7860/api/health/`).

### 3.2 Baza SQLite i migracje

- [ ] **CO:** Sprawdź schemat `users` (kolumna `last_login`).  
  **DLACZEGO:** Login bez kolumny dawał 500.  
  **JAK:**
  ```bash
  sqlite3 /srv/hbrl/Metadata-Engine/data/music_metadata.db ".schema users"
  ```
  **OK gdy:** W schemacie jest `last_login`.

- [ ] **CO:** Jeśli brakuje kolumny — dodaj (jednorazowo) **lub** przebuduj kontener z aktualnym `db.py` i rozważ rozszerzenie `run_migrations()` o `ALTER TABLE users ADD COLUMN last_login`.  
  **JAK (awaryjnie):**
  ```bash
  sqlite3 data/music_metadata.db "ALTER TABLE users ADD COLUMN last_login DATETIME;"
  ```
  **OK gdy:** `POST /api/auth/login` nie zwraca błędu SQL.

- [ ] **CO:** Potwierdź konto admina (`is_superuser=1`) dla `hardbanrecordslab.pl@gmail.com`.  
  **JAK:**
  ```bash
  sqlite3 data/music_metadata.db "SELECT email, is_superuser, tier, credits FROM users WHERE email LIKE '%hardbanrecordslab%';"
  ```
  **OK gdy:** `is_superuser=1` lub użytkownik tworzony przez `ensure_admin_user()` w `backend/app/startup.py` (hasło admina zmień po pierwszym logowaniu — **nie dokumentuj hasła w repo**).

### 3.3 Health i diagnose

- [ ] **CO:** Test podstawowy health.  
  **JAK:**
  ```bash
  curl -sS http://127.0.0.1:8888/api/health/
  curl -sS http://127.0.0.1:8888/api/health
  ```
  **OK gdy:** Pierwszy → `{"status":"ok"}`; drugi → `healthy` + wersja 2.1.0.

- [ ] **CO:** Napraw `diagnose` przed testem zewnętrznym (Faza 6) — tymczasowo oczekuj 500 do patcha.

### 3.4 Zasoby i sieć Docker

- [ ] **CO:** Potwierdź `networks: hbrl-network: external: true` — sieć musi istnieć.  
  **JAK:** `docker network ls | grep hbrl`  
  **OK gdy:** Kontener w sieci `hbrl-network` bez błędu startu.

- [ ] **CO:** Port tylko lokalny: `127.0.0.1:8888:7860` — backend **nie** powinien być publiczny poza Nginx.  
  **OK gdy:** `ss -tlnp | grep 8888` pokazuje bind na 127.0.0.1.

---

## Faza 4: Frontend Vercel (build, env, rewrites)

**Czas:** ~1–2 h  
**Cel:** UI proxy'uje API poprawnie; auth i export trafiają we właściwe ścieżki.

### 4.1 Konfiguracja Vercel

- [ ] **CO:** Projekt frontendu — Root Directory: `frontend` (jeśli monorepo).  
  **OK gdy:** Build przechodzi na Vercel.

- [ ] **CO:** Sprawdź `frontend/vercel.json` — rewrite `/api/:path*` → `https://metadata.hardbanrecordslab.online/api/:path*`.  
  **DLACZEGO:** To omija problem CORS dla relative `/api`.  
  **OK gdy:** Plik jest w deployu Production.

### 4.2 Zmienne środowiskowe frontendu

- [ ] **CO:** `VITE_API_URL` — **opcjonalne**. Domyślnie frontend używa `/api` + rewrite.  
  **Kiedy ustawić:** Jeśli chcesz omijać proxy Vercel i bić prosto w backend: `https://metadata.hardbanrecordslab.online/api` (wtedy CORS na backendzie musi zawierać domenę Vercel — jest regex w `main.py`).  
  **OK gdy:** Świadoma decyzja: proxy Vercel **albo** bezpośredni URL.

### 4.3 Redeploy po fixach frontendu

- [ ] **CO:** Po zmianach w `frontend/apiConfig.ts`, `AuthContext.tsx`, `backendService.ts`, `export.ts` — **Redeploy Production** na Vercel.  
  **DLACZEGO:** `getFullUrl()` na produkcji zwraca `/api/...` — bez redeploy fixy nie trafią do użytkowników.  
  **JAK:** Vercel Dashboard → Deployments → Redeploy **lub** push na branch podpięty pod Production.  
  **OK gdy:** Ostatni deployment = commit z fixami; data < 1 h od merge.

### 4.4 Weryfikacja AuthContext

- [ ] **CO:** `authUrl('/me')` → `getFullUrl('/auth/me')` → `/api/auth/me` (poprawne: router auth ma prefix `/auth` pod `/api`).  
  **JAK (w przeglądarce, DevTools → Network):** Po logowaniu request do `/api/auth/me` → 200.  
  **OK gdy:** Profil użytkownika ładuje się bez pętli logout.

---

## Faza 5: Nginx / DNS / SSL

**Czas:** ~1 h (jeśli już działa — tylko weryfikacja)  
**Cel:** HTTPS na obu domenach, poprawne proxy do 8888.

### 5.1 DNS

- [ ] **CO:** Rekordy DNS (u dostawcy domeny):  
  - `app-metadata.hardbanrecordslab.online` → Vercel  
  - `metadata.hardbanrecordslab.online` → A/AAAA VPS `84.247.162.167`  
  **JAK:** `dig +short app-metadata.hardbanrecordslab.online` / `metadata.hardbanrecordslab.online`  
  **OK gdy:** Rozwiązywanie zgodne z powyższym.

### 5.2 Nginx (VPS)

- [ ] **CO:** Konfiguracja vhost dla `metadata.hardbanrecordslab.online`:  
  - `location /api/` → `proxy_pass http://127.0.0.1:8888/api/`  
  - nagłówki: `Host`, `X-Real-IP`, `X-Forwarded-For`, `X-Forwarded-Proto`  
  - limity uploadu (analiza audio do ~100 MB — zgodnie z `main.py`)  
  **JAK:**
  ```bash
  nginx -t
  systemctl reload nginx
  curl -sS -o /dev/null -w "%{http_code}\n" https://metadata.hardbanrecordslab.online/api/health/
  ```
  **OK gdy:** HTTP 200 przez HTTPS.

### 5.3 Certyfikaty SSL

- [ ] **CO:** Sprawdź ważność certyfikatów (certbot).  
  **JAK:** `certbot certificates | grep -A2 metadata`  
  **OK gdy:** Wygaśnięcie > 30 dni lub auto-renew w cron.

### 5.4 CORS i cookies

- [ ] **CO:** Potwierdź, że frontend woła API przez **ten sam host** (`/api` na Vercel) lub HTTPS backend z dozwolonym origin.  
  **OK gdy:** Brak błędów CORS w konsoli przy loginie i analizie.

---

## Faza 6: Naprawa znanych bugów (konkretne pliki)

**Czas:** ~4–8 h (+ retest)  
**Cel:** Zamknąć luki z audytu przed testami E2E.

### 6.1 Export 404 (`/api/export` vs `/auth/export`)

**Problem:** `export_router` w `main.py` tylko pod `prefix="/auth"` → endpointy: `/auth/export/csv/{id}`.  
Frontend: `backendService.ts`, `utils/export.ts`, `components/imported/ExportModal.tsx` → `/api/export/...`.

**Wybierz jedną strategię (zalecana: A):**

**A) Duplikat routera pod `/api` (minimalny diff backend):**
- [ ] **CO:** W `backend/app/main.py` dodaj:
  ```python
  app.include_router(export_router, prefix="/api")
  ```
  (obok istniejącego `prefix="/auth"`).  
  **DLACZEGO:** Frontend i dokumentacja używają `/api/export`.  
  **OK gdy:** `curl -sS -o /dev/null -w "%{http_code}" https://metadata.hardbanrecordslab.online/api/export/csv/TEST_ID` → 404 z body JSON (nie nginx 404) lub 401/422 — **ścieżka istnieje**.

**B) Poprawka frontend:**
- [ ] **CO:** W `frontend/services/backendService.ts` zmień ścieżki na `/auth/export/...` **lub** helper `authApiUrl(path)`.  
  **Pliki:** `backendService.ts`, `utils/export.ts`, `ExportModal.tsx`, `DistributionCard.tsx`.  
  **OK gdy:** URL w Network to `/api/auth/export` **nie** — poprawnie `/auth/export` przez rewrite: potrzebny rewrite Vercel `/auth` **lub** pełny URL backendu.

### 6.2 Tools pod `/auth` (`/api/tools` → 404)

- [ ] **CO:** Analogicznie — `tools_router` tylko na `/auth`.  
  **Pliki:** `frontend/components/ToolsPanel.tsx` (`getFullUrl('/tools/...')`), `CONFIG_KEYS.md` (wspomina `/api/tools/...`).  
  **Fix:** `app.include_router(tools_router, prefix="/api")` w `main.py` **lub** zmiana frontend na `/auth/tools/...`.  
  **OK gdy:** `POST /api/tools/strip-metadata` (lub `/auth/tools/strip-metadata` po ujednoliceniu) zwraca plik/JSON.

### 6.3 DDEX / CWR ścieżki

- [ ] **CO:** `frontend/services/distributionService.ts` woła `getFullUrl('/ddex/export')` → `/api/ddex/export`, backend: `/auth/ddex/...`.  
  **Fix:** duplicate router pod `/api` **lub** prefix `/auth` w fetch.  
  **OK gdy:** Eksport DDEX/CWR z UI nie daje 404.

### 6.4 `/api/health/diagnose` → 500

- [ ] **CO:** W `backend/app/config.py` dodaj:
  ```python
  AUDD_API_TOKEN = os.getenv("AUDD_API_TOKEN") or os.getenv("ACOUSTID_API_TOKEN")
  ```
  **albo** w `backend/app/routes/health.py` zamień `AUDD_API_TOKEN` na `ACOUSTID_API_TOKEN` / `ACOUSTID_API_KEY`.  
  **DLACZEGO:** Odwołanie do nieistniejącego atrybutu `settings` wywala endpoint.  
  **OK gdy:**
  ```bash
  curl -sS https://metadata.hardbanrecordslab.online/api/health/diagnose | jq .
  ```
  → HTTP 200, JSON ze statusem kluczy.

### 6.5 Batch analyze (stub)

- [ ] **CO:** `backend/app/routes/batch.py` — placeholder; `frontend/components/BatchAnalysisPanel.tsx` woła `/api/batch/analyze`.  
  **Opcje:**  
  1. **Krótkoterminowo:** Ukryj/wyłącz panel w UI + oznacz „W przygotowaniu” w dokumentacji.  
  2. **Docelowo:** Podłącz do istniejącego pipeline (`analysis_router` / fresh_analysis).  
  **OK gdy:** Użytkownik nie widzi obietnicy „batch ML” bez implementacji **albo** endpoint zwraca realne wyniki.

### 6.6 DDEX duration 180 s

- [ ] **CO:** W `backend/app/services/ddex_orchestrator.py` (~linia 117) — czytaj `duration` z metadanych joba zamiast stałej `180`.  
  **Pliki:** `ddex_orchestrator.py`, upewnij się że `analysis` zapisuje `duration` w `job.result`.  
  **OK gdy:** Wygenerowany XML ma `PT{x}M{y}S` zgodne z długością utworu (tolerancja ±2 s).

### 6.7 CWR WRITER001

- [ ] **CO:** W `backend/app/services/cwr_gen.py` — zastąp placeholder prawdziwymi danymi writer/publisher z metadanych (pola IPI/ISWC jeśli dostępne).  
  **OK gdy:** Plik CWR importuje się w narzędziu testowym PRO bez błędu „unknown writer” (test manualny).

### 6.8 Migracje DB (`db.py`)

- [ ] **CO:** Rozszerz `run_migrations()` o brakujące kolumny: `users.last_login`, ewentualnie kolumny z `backend/migrate_db.py`.  
  **DLACZEGO:** `create_all` nie alteruje istniejących tabel SQLite.  
  **OK gdy:** Nowa instalacja **i** stara baza przechodzą start bez ręcznego SQL.

### 6.9 `backendService` — nieistniejące endpointy tagowania

- [ ] **CO:** `getFullUrl('/tag/flac')` / `/tag/wav` — w `tagging.py` jest `/tag/file`.  
  **Fix:** Użyj `/api/tag/file` z odpowiednim formatem **lub** dodaj dedykowane route.  
  **OK gdy:** Tagowanie z UI nie zwraca 404.

### 6.10 Bezpieczeństwo compose

- [ ] **CO:** Usuń jawny `SECRET_KEY` z `vps.docker-compose.yml` (`environment:`).  
  **OK gdy:** Sekret tylko w `.env` / Secrets.

### 6.11 Rebuild i deploy po patchach

- [ ] **CO:** Lokalnie przetestuj, użytkownik commituje, push `main`, poczekaj na CI **lub** ręczny rebuild na VPS (Faza 3).  
  **OK gdy:** Wersja w `/api/health` odpowiada oczekiwanej po deployu.

---

## Faza 7: Testy smoke i E2E

**Czas:** ~2–3 h  
**Cel:** Potwierdzenie „100%” wg definicji powyżej.

### 7.1 Smoke — curl (publiczne API)

Wykonaj z maszyny z dostępem do internetu (zamień `TOKEN`, `JOB_ID`):

```bash
BASE="https://metadata.hardbanrecordslab.online"
APP="https://app-metadata.hardbanrecordslab.online"

# 1. Health
curl -sS "$BASE/api/health/" | jq .
curl -sS "$BASE/api/health" | jq .
curl -sS "$BASE/api/health/diagnose" | jq .

# 2. Login
curl -sS -X POST "$BASE/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"hardbanrecordslab.pl@gmail.com","password":"<HASLO>"}' | jq .

export TOKEN="<access_token_z_odpowiedzi>"

# 3. Profil
curl -sS "$BASE/api/auth/me" -H "Authorization: Bearer $TOKEN" | jq .

# 4. Export (po fixie — ścieżka zgodna z Fazą 6)
curl -sS -o /dev/null -w "%{http_code}\n" \
  -H "Authorization: Bearer $TOKEN" \
  "$BASE/auth/export/csv/$JOB_ID"
# lub /api/export/csv/$JOB_ID jeśli zastosowano duplikat routera

# 5. Tools (mały plik testowy)
curl -sS -X POST "$BASE/auth/tools/strip-metadata" \
  -F "file=@test.mp3" -o /tmp/stripped.mp3 -w "%{http_code}\n"

# 6. Frontend proxy (przez Vercel)
curl -sS -o /dev/null -w "%{http_code}\n" "$APP/api/health/"
```

**Checklist OK:**
- [ ] Wszystkie health → 200  
- [ ] Login → 200 + `access_token`  
- [ ] `/me` → 200, `is_superuser` true dla admina  
- [ ] Export → nie 404 na poprawnej ścieżce  
- [ ] `$APP/api/health/` → 200 (rewrite Vercel)

### 7.2 Smoke — funkcje wymagające kluczy API

- [ ] **Transkrypcja / AI:** upload krótkiego MP3 → analiza z GROQ/GEMINI (wymaga kluczy).  
- [ ] **Spotify/Last.fm:** wzbogacenie metadanych — brak 401 w logach.  
- [ ] **Fingerprint:** `POST` fingerprint (AcoustID) — jeśli skonfigurowane.  
- [ ] **Webhook Lemon Squeezy:** tylko test staging/signature (opcjonalnie).

### 7.3 Checklist manualna UI (przeglądarka)

Otwórz `https://app-metadata.hardbanrecordslab.online` (okno incognito + okno zalogowane):

- [ ] Strona główna ładuje się bez błędów w konsoli (F12)  
- [ ] Rejestracja nowego użytkownika (opcjonalnie)  
- [ ] Logowanie admina  
- [ ] Upload 1 pliku audio → analiza kończy się statusem sukces  
- [ ] Wyniki: BPM, key, duration widoczne  
- [ ] Pobranie CSV / JSON z karty Distribution  
- [ ] DDEX XML / CWR — plik się pobiera, otwiera w edytorze  
- [ ] Tools: strip metadata / convert (jeśli w UI)  
- [ ] Historia analiz (`UsagePanel` / history) — lista się ładuje  
- [ ] Wylogowanie — token usunięty, redirect OK  
- [ ] Mobile / szerokość — brak krytycznych błędów layoutu (smoke UX)

### 7.4 Test regresji login (znany incydent)

- [ ] **CO:** Powtórz scenariusz, który dawał 502/500.  
  **OK gdy:** Brak 502 z Nginx; brak 500 SQL na `last_login`.

---

## Faza 8: Monitoring, backupy, rate limiting (opcjonalne, ale w planie)

**Czas:** ~2–4 h (można rozłożyć na tydzień 2)

### 8.1 Monitoring

- [ ] **CO:** Healthcheck Docker już jest — dodaj zewnętrzny ping (UptimeRobot / Hetrix / cron curl).  
  **URL:** `https://metadata.hardbanrecordslab.online/api/health/` co 5 min.  
  **OK gdy:** Alert e-mail przy 2× fail.

- [ ] **CO:** Rotacja logów: `docker logs` + volume `./logs`.  
  **JAK:** `logrotate` lub limit rozmiaru w compose.  
  **OK gdy:** Dysk VPS nie zapycha się logami MME.

### 8.2 Backupy automatyczne

- [ ] **CO:** Cron na VPS — codzienny tarball `data/` + `.env` do `/srv/hbrl/backups/`.  
  **Przykład crontab:**
  ```bash
  0 3 * * * cd /srv/hbrl/Metadata-Engine && tar -czf /srv/hbrl/backups/mme-data-$(date +\%F).tar.gz data
  ```
  **OK gdy:** Pliki z ostatnich 7 dni; test odtworzenia na staging.

### 8.3 Rate limiting / bezpieczeństwo

- [ ] **CO:** Nginx `limit_req` na `/api/auth/login` i upload endpoints.  
- [ ] **CO:** Fail2ban lub Cloudflare (jeśli DNS przez CF) — opcjonalnie.  
- [ ] **CO:** Zmiana domyślnego hasła seed admina (`startup.py`) po pierwszym deploy — **akcja użytkownika**.  
  **OK gdy:** Brak brute-force bez limitu; admin nie używa hasła z kodu seed.

### 8.4 GitHub Actions

- [ ] **CO:** Zweryfikuj, że deploy nie kasuje danych w `data/` (volume mount poza obrazem).  
  **OK gdy:** Po deploy liczba użytkowników w SQLite bez zmian (chyba że świadoma migracja).

---

## Faza 9: Aktualizacja dokumentacji

**Czas:** ~1–2 h

- [ ] **CO:** Przepisz `FINAL_VERIFICATION_REPORT.md`:  
  - data i commit hash  
  - tabela funkcji: **Działa / Częściowo / Nie / Nie testowano**  
  - jawne ograniczenia: batch stub, DDEX 180s, CWR WRITER001  
  - wyniki curl z Fazy 7 (bez sekretów)  
  - ścieżki kanoniczne API (`/api` vs `/auth`) po fixach  
- [ ] **CO:** Zaktualizuj `CONFIG_KEYS.md` jeśli produkcja = SQLite (nie Postgres) — uniknij mylenia operatorów.  
- [ ] **CO:** W `HRL_Unified_Bible_2026.md` — tylko status Metadata Engine i data weryfikacji (bez haseł).  
  **OK gdy:** Nowy developer może wdrożyć od zera według tego planu + CONFIG_KEYS.

---

## Harmonogram sugerowany

| Dzień | Godziny | Fazy | Rezultat |
|-------|---------|------|----------|
| **D1** | 2–3 h | 0 + 1 | Backup, inwentaryzacja, decyzja Git, push `main` (user) |
| **D1** | 2 h | 2 + 3 | `.env`, rebuild Docker, health OK |
| **D2** | 4–6 h | 6 | Fixy routing/export/diagnose/DB |
| **D2** | 1 h | 4 + 5 | Vercel redeploy, weryfikacja Nginx/SSL |
| **D3** | 3 h | 7 | Smoke curl + checklist UI |
| **D4** | 2 h | 8 + 9 | Monitoring, backup cron, dokumentacja |

**Łącznie:** ~16–20 h czystej pracy rozłożonej na 3–4 dni.

---

## Ryzyka i rollback

| Ryzyko | Skutek | Mitigacja | Rollback |
|--------|--------|-----------|----------|
| `git reset --hard` na VPS | Utrata lokalnych patchy | Patch przed resetem | `git reflog` + przywrócenie commita |
| CI nadpisuje `.env` | Złe/brakujące klucze | Secrets kompletne przed push | Przywróć `.env` z `BACKUP_DIR` |
| Rebuild Docker | Krótka niedostępność | Deploy w oknie nocnym | `docker compose up` z poprzednim obrazem `music-metadata-engine:latest` (jeśli tagowany) |
| Migracja SQLite | Uszkodzenie DB | Backup przed ALTER | `cp backup/music_metadata.db data/` + restart kontenera |
| Duplikat routerów `/api` + `/auth` | Podwójne surface API | OK świadomie; dokumentuj | Usuń duplikat w `main.py`, redeploy |
| Vercel cache | Stary JS | Redeploy + hard refresh | Poprzedni deployment w Vercel |

**Procedura rollback (szybka):**
```bash
cd /srv/hbrl/Metadata-Engine
docker compose -f vps.docker-compose.yml down
cp "$BACKUP_DIR/.env" .env
cp "$BACKUP_DIR/data/music_metadata.db" data/music_metadata.db
git checkout <POPRZEDNI_HASH>
docker compose -f vps.docker-compose.yml up -d --build
```

Na Vercel: **Instant Rollback** do poprzedniego deploymentu.

---

## Czego NIE ruszać na VPS (krytyczne)

Podczas prac nad Metadata-Engine **nie wykonuj** (chyba że osobny, zatwierdzony projekt infrastruktury):

| Zasób | Powód |
|-------|--------|
| **WordPress** (`hardbanrecordslab.online`, kontenery WP, mu-plugins SSO) | SSO całego ekosystemu HRL |
| **PostgreSQL `hbrl-postgres` / `hbrl_master`** | Współdzielona baza 42 tabel — Metadata prod używa **SQLite w volume**; zmiana na Postgres to osobna migracja |
| **Inne usługi PM2** (Access Manager :9107, User Hub, WriteMuse, Sync Hub, itd.) | Niezależne API; błąd restartu = awaria innych aplikacji |
| **Moduły FROZEN** (OmniPost, Community) | Zamrożone decyzją 2026-05-16 — nie włączać PM2 |
| **AzuraCast / streaming** (jeśli działa na tym VPS) | Osobny stack mediów — ryzyko przerw wanilia |
| **Sieć Docker `hbrl-network`** | Nie usuwaj — tylko upewnij się, że istnieje; Metadata się do niej podłącza |
| **Porty 80/443 globalne Nginx** | Edytuj tylko vhost `metadata.*`, nie cały `nginx.conf` bez kopii |
| **Firewall / SSH** | Bez zmian reguł podczas deployu aplikacji |

**Dozwolone zakresy prac:** `/srv/hbrl/Metadata-Engine`, vhost Nginx dla `metadata.hardbanrecordslab.online`, kontener `metadata-backend`, katalog `/srv/hbrl/backups/metadata-engine-*`.

---

## Podsumowanie priorytetów (kolejność „must fix”)

1. Backup + sync Git (Fazy 0–1)  
2. `.env` + Docker healthy (Fazy 2–3)  
3. **Export + tools routing** + **health diagnose** (Faza 6) — największy wpływ na „produkcyjność”  
4. Vercel redeploy + Nginx verify (Fazy 4–5)  
5. Smoke + UI checklist (Faza 7)  
6. Dokumentacja prawdy (Faza 9)  
7. Batch ML, DDEX/CWR perfection — backlog po „100%” wg definicji powyżej  

---

## Załącznik: Pliki referencyjne w repo

| Plik | Rola |
|------|------|
| `vps.docker-compose.yml` | Produkcja VPS, port 127.0.0.1:8888, SQLite |
| `docker-compose.yml` | Dev/local (port 8888 publiczny) |
| `.github/workflows/deploy.yml` | Auto-deploy z Secrets |
| `frontend/vercel.json` | Proxy `/api` → backend |
| `frontend/apiConfig.ts` | `getFullUrl`, `API_BASE_URL` |
| `backend/app/main.py` | Mapowanie routerów `/api` vs `/auth` |
| `backend/app/config.py` | Zmienne środowiskowe |
| `backend/app/db.py` | Modele + `run_migrations()` |
| `CONFIG_KEYS.md` | Lista kluczy (bez wartości) |

---

*Plan gotowy do wklejenia jako dokument operacyjny. Commity Git i push na `main` — wyłącznie jako świadoma akcja użytkownika po review zmian z Fazy 6.*
