# Legal Overview

> **This is a plain-language map, not a contract.** The binding text is what
> the app renders in `frontend/components/LegalModal.tsx` (Terms of Service,
> Privacy Policy, GDPR Compliance, Cookies Policy, AI Disclaimer), reachable
> from the app footer. Where this summary and that text differ, that text
> governs. Nothing here is legal advice.

## Who operates the Service

**HardbanRecords Lab** — Poland, EU.
Contact / Data Protection: **contact@hardbanrecordslab.online**.
Governing law: **Republic of Poland**; EU consumers keep their local
mandatory protections.

`[DO UZUPEŁNIENIA]` — the binding documents still need the registered company
identifiers (NIP / REGON / KRS or sole-proprietor details) and registered
address wherever Polish law requires them.

## What data is processed

| Category | Examples | Basis |
|---|---|---|
| Account | email, password hash | contract |
| Usage / technical | IP, browser, timestamps, feature use | legitimate interest |
| Financial | handled by **Stripe** — we never see or store card numbers | contract |
| Audio you upload | processed to produce metadata; not used to train models | contract |

**Architecture note:** analysis runs on a single server (a VPS in the EU) plus
third-party AI APIs. Audio and a compact feature representation are sent to
those APIs (Groq, Google Gemini, OpenRouter) for classification; enrichment
and identification providers (Spotify, Last.fm, Discogs, ACRCloud, AcoustID,
MusicBrainz) receive query data as needed; certificates are pinned to IPFS
via Pinata. Transfers outside the EEA rely on Standard Contractual Clauses /
adequacy decisions.

## Your GDPR rights

Access, rectification, erasure, restriction, portability, objection.
**Self-service in the app:** Settings → Security lets a signed-in user
download a full JSON export (`GET /auth/me/export`) and permanently delete
their account (`DELETE /auth/me`, password-confirmed). For anything else,
email **contact@hardbanrecordslab.online**, subject `GDPR Request` — we
respond within one month. Breaches affecting your rights are notified within
72 hours.

## Billing & refunds

- One-time **credit packs** (not a subscription): Starter $9 / Producer $35 /
  Label $89 / Studio $199. 3 free credits on signup.
- **Stripe** is the payment processor. **HardbanRecords Lab is the seller** —
  it issues invoices and accounts for its own VAT.
- Refunds: initial purchases may qualify for a limited refund window under the
  then-current refund policy and local consumer law.

`[DO WERYFIKACJI PRAWNEJ]`:
- EU VAT / OSS registration and invoicing obligations for a Polish business
  selling digital services to EU + non-EU consumers.
- The EU 14-day right of withdrawal for digital content and the standard
  "immediate performance — you consent and lose the withdrawal right" clause
  that a credit-pack model needs.

## Ownership of results

- **Your audio stays yours.** You grant only the licence needed to process it.
- **Output metadata / text / analysis** — HardbanRecords Lab assigns to you
  any rights it may hold in what the Service generates from your content.
- **Caveat (AI Disclaimer):** under current US and EU guidance, content
  generated *entirely* by AI without meaningful human input may not be
  copyrightable. AI output (genre, copyright-owner guesses, biography-style
  text, cover art) is a **suggestion** — you must review and edit before
  distributing, and disclose AI use where the EU AI Act requires it.
  HardbanRecords Lab is not liable for takedowns or rejected releases
  resulting from unverified AI metadata.

## Cookies / local storage

The app prefers `localStorage` to cookies. Essential entries keep you logged
in and remember your theme; functional entries remember ISRC prefix / catalog
counter and autosave work-in-progress. Payment (Stripe Checkout) and "Sign in
with Google" set their own cookies during those flows. Analytics, if enabled,
are anonymised and opt-out.

## Age

Not directed at anyone under 16; we don't knowingly collect their data.

## Open items for a lawyer

1. Company identifiers + registered address in every binding document.
2. VAT/OSS treatment and invoice wording (Stripe, not a Merchant of Record).
3. Right-of-withdrawal clause for the credit-pack model.
4. Confirm the analytics stack actually deployed (the Cookies Policy lists
   PostHog / GA4 as optional) and the DPA offer for B2B users.
