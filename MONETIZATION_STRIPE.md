# Monetyzacja — pakiety kredytów (Stripe)

**Model:** jednorazowe zakupy kredytów (bez subskrypcji na start).  
**1 kredyt = 1 pełna analiza** (eksport po analizie bez dodatkowego kosztu).

## Pakiety

| ID (`pack_id`) | Nazwa | Kredyty | Cena USD | Zmienna `.env` (Price ID) |
|----------------|-------|---------|----------|---------------------------|
| `starter` | Starter Pack | 10 | $9 | `STRIPE_PRICE_PACK_STARTER` |
| `producer` | Producer Pack | 50 | $35 | `STRIPE_PRICE_PACK_PRODUCER` |
| `label` | Label Pack | 150 | $89 | `STRIPE_PRICE_PACK_LABEL` |
| `studio` | Studio Pack | 400 | $199 | `STRIPE_PRICE_PACK_STUDIO` |

**Free tier:** 3 kredyty po rejestracji.

## Konfiguracja Stripe (Test → Live)

1. [Stripe Dashboard](https://dashboard.stripe.com) → **Products** → utwórz 4 produkty z ceną **One time**.
2. Skopiuj **Price ID** (`price_...`) do `.env` na VPS i GitHub Secrets.
3. **Developers → Webhooks** → Add endpoint:
   - URL: `https://metadata.hardbanrecordslab.online/api/billing/webhook/stripe`
   - Events: `checkout.session.completed`
4. Skopiuj **Signing secret** → `STRIPE_WEBHOOK_SECRET`.
5. **API keys** → Secret key → `STRIPE_SECRET_KEY`.

## API (backend)

| Metoda | Ścieżka | Opis |
|--------|---------|------|
| GET | `/api/billing/packs` | Katalog pakietów |
| POST | `/api/billing/checkout` | Tworzy sesję Checkout (wymaga `Authorization: Bearer`) |
| POST | `/api/billing/webhook/stripe` | Webhook Stripe (raw body + podpis) |

Body checkout: `{ "pack_id": "producer" }` → `{ "checkout_url": "https://checkout.stripe.com/..." }`.

## Flow użytkownika

1. Ustawienia → **Kup kredyty** → wybór pakietu → Stripe Checkout.
2. Po płatności → redirect na `app-metadata.../?billing=success` → `refetchUser()` → kredyty w UI.
3. Webhook dodaje kredyty w SQLite (`credit_purchases` = idempotencja).

## Test lokalny

```bash
stripe listen --forward-to localhost:8888/api/billing/webhook/stripe
```

Użyj `whsec_...` z CLI jako `STRIPE_WEBHOOK_SECRET` w lokalnym `.env`.

## Przestarzałe (nie używać)

- `frontend/utils/lemonSqueezy.ts`
- `frontend/api/webhook.js` (Lemon + Supabase)
- `LEMONSQUEEZY_*` w secrets
