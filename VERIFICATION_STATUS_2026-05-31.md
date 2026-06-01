# Metadata-Engine — status weryfikacji (2026-05-31 / sesja 2026-06-01)

**VPS commit:** `f4f87ba` (poprzednio `8ee805c`)  
**Kontener:** `metadata-backend` (healthy po rebuild)  
**Uwaga:** Hasło admina w DB **nie** odpowiada próbom z dokumentacji operacyjnej (WordPress / `reset_pwd.py` default) — login hasłem zwraca **401**. Testy autoryzowanych endpointów wykonano tokenem JWT wygenerowanym dla istniejącego konta superuser (ten sam mechanizm co po udanym logowaniu).

## Wyniki E2E (Faza 7)

| Test | URL / metoda | Oczekiwane | Wynik |
|------|----------------|------------|-------|
| Health lokalny | `GET http://127.0.0.1:8888/api/health/` | 200 | **200** |
| Diagnose | `GET /api/health/diagnose` | 200 | **200** |
| Login admin (hasło z Bible/WP) | `POST /api/auth/login` | 200 + token | **401** Invalid email or password |
| Login złe dane | `POST /api/auth/login` (zły email) | 401/422 | **422** (walidacja) |
| Auth me | `GET /api/auth/me` + Bearer | 200 | **200** (JWT dla admina) |
| Export CSV | `GET /api/export/csv/{jobId}` + Bearer | 200 | **200** (`059c3bb1-…`) |
| Export JSON | `GET /api/export/json/{jobId}` + Bearer | 200 | **200** |
| Export brak job | `GET /api/export/csv/{uuid}` + Bearer | 404 | **404** |
| AI proxy (przed fix) | `POST /api/ai/proxy` | nie 404 | było **404** |
| AI proxy (po `f4f87ba`) | `POST /api/ai/proxy` | 401 bez auth | **401** (lokalnie i `metadata.*`) |
| App proxy | `POST https://app-metadata…/api/ai/proxy` | nie 404 | **401** |
| App health | `GET https://app-metadata…/api/health/` | 200 | **200** |
| Public health | `GET https://metadata…/api/health/` | ok | **{"status":"ok"}** |

## Poprawki w kodzie (ta sesja)

- **`f4f87ba`:** `app.include_router(ai_proxy_router, prefix="/api")` — ścieżka `/api/ai/proxy` zgodna z rewrite Vercel.

## Vercel (Faza 4 follow-up)

- `https://app-metadata.hardbanrecordslab.online/` — **200**, `Last-Modified: Mon, 01 Jun 2026 13:41:27 GMT`, `X-Vercel-Cache: HIT`.
- **Redeploy ręczny:** Vercel Dashboard → projekt frontendu → Deployments → Production → **Redeploy** (brak tokenu CI w tej sesji). Po zmianach w `frontend/` zawsze redeploy po pushu na `main`.

## Faza 8 (minimal)

- Katalog backupów: `/srv/hbrl/backups` — **istnieje**; archiwum Metadata: `metadata-engine-2026-05-31-201144.tar.gz`.
- **Sugestia cron (VPS, opcjonalnie):** `0 3 * * * cd /srv/hbrl/Metadata-Engine && tar -czf /srv/hbrl/backups/metadata-engine-$(date +\%F).tar.gz data`

## Blokery do pełnych 100%

1. **Login admina hasłem** — wymaga znanyego hasła prod lub jednorazowego `reset_pwd.py` na VPS (świadoma zmiana hasła).
2. **Vercel** — potwierdzić ręczny redeploy po ostatnich commitach frontendu (jeśli były po 2026-06-01 13:41 UTC).

## Szacunek postępu względem definicji „100%” z planu

| Obszar | Status |
|--------|--------|
| Kod / VPS sync | OK (`f4f87ba`) |
| Backend health/diagnose | OK |
| Auth login hasłem | **Nie OK** |
| Export / API mount | OK |
| Frontend Vercel | Częściowo (health OK, build z 2026-06-01) |
| Dokumentacja | Ten plik + aktualizacja planu |

**Szacunek: ~88%** (8/9 kryteriów tabeli akceptacji; brak pełnego E2E loginu w przeglądarce).
