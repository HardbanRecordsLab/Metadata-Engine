# SEO

## Constraints

The app is a **routerless single-page app** behind login. Only the landing
route (`/`) has public SEO value — the dashboard, analysis and settings views
are gated. Vercel serves `index.html` for every path.

So the strategy is: make `index.html` itself rich, and bake real content into
the `#root` container that React replaces on mount. No SSG / prerender-with-
Puppeteer — it would re-bloat the frontend Docker build (which was just
trimmed) for almost no gain on a gated app.

## Canonical domain

`https://app-metadata.hardbanrecordslab.online/`

Use it consistently in `<link rel="canonical">`, `og:url`, `robots.txt`
`Sitemap:`, and `sitemap.xml`. (`metadata.hardbanrecordslab.online` is the
API host, not the site.)

## What's in place (`frontend/`)

| File | SEO role |
|---|---|
| `index.html` `<head>` | `<title>`, `<meta description>`, `keywords`, `canonical`, `robots`, full Open Graph + Twitter, `og:image` → `/assets/og-image.png` |
| `index.html` JSON-LD | one `<script type="application/ld+json">` with an `@graph`: `Organization`, `WebSite`, `SoftwareApplication` (with `offers` = the 4 credit packs), `FAQPage` |
| `index.html` `#root` content | a real `<main>` — H1, value proposition, feature list, `<details>` FAQ, footer links — with inline critical CSS. React's `createRoot(...).render()` clears it on hydration, so users never see it; crawlers and no-JS clients do. |
| `public/sitemap.xml` | lists `/` (the only public URL). Update `lastmod` when the landing copy changes. |
| `public/robots.txt` | allow all, `Disallow: /api/ /admin/ /verify/`, points at the sitemap |
| `App.tsx` | small `useEffect` sets `document.title` per view for shared/bookmarked links |
| `vercel.json` | long-cache immutable headers for hashed `/assets/*` bundles |

## Maintenance

- **Changed the pitch, features, or pricing?** Update three places so they
  stay in sync: the `#root` fallback content and the JSON-LD in `index.html`,
  and `docs/BUSINESS.md`. Bump `sitemap.xml` `lastmod`.
- **New public page/route?** (would need react-router first) — add it to
  `sitemap.xml` and give it its own `<title>`/description.
- **og:image** is `frontend/public/assets/og-image.png` (1200×630). Regenerate
  if the brand or tagline changes.
- Validate JSON-LD after edits: paste the deployed URL into Google's Rich
  Results Test; check `Organization` / `SoftwareApplication` / `FAQPage`
  parse.
- Keep the FAQ in the JSON-LD identical to the visible FAQ (`#root` fallback
  and/or `ResourcesModal` 'help') — mismatched FAQPage markup is a manual
  action risk.

## Not done (future)

- Real per-route SSR/SSG — needs a router migration.
- `hreflang` — the app is English-only; add if a localized version ships.
- A dedicated marketing site separate from the app.
