# [Project name]

_Replace the heading above with the project's name, and this line with one sentence describing what this app does for users._

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string
- Required env (plant identification): `PLANTNET_API_KEY` — key from https://my.plantnet.org/ (set as a Replit Secret, never hardcoded). Optional: `PLANTNET_PROJECT` (default `all`) to scope identification to a regional PlantNet flora project.
- Optional env (plant care/use enrichment): `PERENUAL_API_KEY` — key from https://perenual.com/docs/api (Replit Secret, never hardcoded). Without it, `/api/plant-identify` still works with PlantNet results alone (`enrichment` comes back `null`). The free Perenual tier is limited: `species-list` search often misses full two-word binomials (works better with the genus alone — the backend tries both) and only has a small species subset, and even a match frequently has `watering`/`sunlight`/`growth_rate`/`description` locked behind a paywall (returned as an "Upgrade Plan..." string, which the backend detects and treats as `null`).
- Frontend fallback cascade for plant care/use info (per field, in `CameraDialog` in `App.tsx`): Perenual → local catalog → Wikipedia (`es.wikipedia.org`, both the intro paragraph and, when present, a habitat/distribution section and a uses-like section — matched by heading keyword since the exact title varies per article, e.g. "Usos", "Uso en la medicina tradicional", "Importancia económica y cultural") → GBIF (`api.gbif.org`, no key needed; only used for a habitat/distribution note built from top occurrence countries via `species/match` + `occurrence/search` — GBIF has no care or "uses" data at all, so it never fills "utilidad") → "No disponible". See `getWikipediaDetails`/`getGbifHabitat` in `lib/plant-identify.ts`.
- Real coverage found while testing the cascade with 3 species (Aloe vera, Cantua buxifolia/Kantuta, Taraxacum rubicundum — see session history for full responses): the local catalog's ~100 auto-generated filler entries (as opposed to the ~18 hand-curated ones) have *generic* boilerplate description/utility text, not real per-species facts, but that text still counts as "present" for the fallback check — so for those species the cascade stops at the catalog and never tries Wikipedia/GBIF, even though the catalog text isn't actually informative. Real gap for "utilidad": in this 3-species test, only 1/3 (Kantuta, from the hand-curated catalog) had genuinely specific utility data; 1/3 (Aloe vera) got generic catalog boilerplate; 1/3 (Taraxacum rubicundum, a PlantNet microspecies match with no Wikipedia article) had **no utility data in any free source** — GBIF structurally can't help here (occurrence/taxonomy only, no uses), so this stays "No disponible" honestly rather than showing invented content.
- **Fixed:** generic catalog entries were blocking the Wikipedia/GBIF fallback. `Plant.id` distinguishes them: the ~100 auto-generated entries (built from `extraNames` in `App.tsx`) always get `id: "especie-${i+1}"` and identical boilerplate `description`/`medicinalUses`/`care` text across all of them; the ~18 hand-curated `corePlants` entries have semantic ids (`"eucalipto"`, `"kantuta"`, ...) and real per-species text. `CameraDialog`'s `isCuratedCatalogEntry(plant)` checks `!plant.id.startsWith('especie-')`; only a curated match counts as "already have this field" for the cascade gate and for `description`/`medicinalUses`/`care` fallback values — `commonName` still uses any catalog match (curated or generated), since that field is always real even on generated entries. Verified with 3 species that have a generic-only catalog entry and an exact PlantNet match (Romero/*Salvia rosmarinus*, Quinua/*Chenopodium quinoa*, Orégano/*Origanum vulgare*): all three now reach Wikipedia and get real description/uses text instead of stopping at the boilerplate.
- **Also fixed while verifying the above:** `getWikipediaDetails`'s section matching picked the *first* heading whose title matched the uses/habitat keyword regex, without checking it had content — some plant articles have an empty-bodied `==` heading (e.g. "Importancia económica y cultural") whose real content lives in the `===` subsections that immediately follow ("Medicina popular", "Usos culinarios", ...), which the flattened section list treats as siblings. Found via *Origanum vulgare* (orégano), where this silently produced `uses: null` despite the article having a very relevant "Usos culinarios" section right after the empty one. Now requires a non-empty body, and the uses keyword regex also matches bare "medicina" (not just "medicinal"), since "Medicina tradicional"/"Medicina popular" are common section titles that don't contain the literal substring "medicinal".

## Stack

- pnpm workspaces, Node.js `^20.19.0 || >=22.12.0` (declared in root `package.json` `engines`; matches Vite 7's own requirement, the strictest in the dependency tree), TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

_Populate as you build — short repo map plus pointers to the source-of-truth file for DB schema, API contracts, theme files, etc._

## Architecture decisions

_Populate as you build — non-obvious choices a reader couldn't infer from the code (3-5 bullets)._

## Product

_Describe the high-level user-facing capabilities of this app once they exist._

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Plant catalog photos (**119** entries, not 118 — verify counts by extracting from source, an earlier session miscounted `extraNames`) have no local image files; 100% external URLs. Intended chain: Wikipedia thumbnail → Pexels stock photo (`fallbackPhoto`, the base `photo` value whenever Wikipedia has nothing) → placeholder SVG (`wikiFallback`, only reached if even Pexels fails to load at runtime, via `onError`). Two rounds of real bugs were found and fixed here, both verified with live HTTP requests / a full 119-species audit, not sampling:
  1. Every entry's `photo` field was force-set to `https://source.unsplash.com/600x400/?<name>+bolivia` (Unsplash's old "Source" endpoint, confirmed dead: `503` on every request), and the Wikipedia-image `useEffect` fired one `fetch` per plant — 119 at once via unthrottled `Promise.all` — which reliably trips Wikipedia's rate limit (reproduced: only ~10% of 58 simultaneous single-title requests succeeded). Fixed by removing the dead Unsplash step and batching the Wikipedia lookups via MediaWiki's `titles=A|B|C` (pipe-separated, up to 50 per request) — 119 requests become 3.
  2. **A regression from fix #1**: the batching fix set the *base* `photo` value to `wikiFallback` (the placeholder SVG) instead of `fallbackPhoto` (Pexels). Since that SVG is itself a real, working URL, `<img>` never errors for species without a Wikipedia thumbnail — `onError` (and therefore the Pexels fallback) never fires at all, going straight to "NO IMAGE AVAILABLE" instead of the intended second tier. Fixed by swapping the roles: base `photo` = `fallbackPhoto` (Pexels), and `onError` now targets `wikiFallback` as the true last resort.
  - **Full 119-species audit** (batched request, exactly what the app sends): without `redirects=1`, only 79/119 (66%) got a Wikipedia thumbnail. Root cause of most of the other 40: many scientific names are thin stub articles that redirect to a richer common-name article with the real photo (`Solanum tuberosum` → `Potato`, `Salvia rosmarinus` → `Rosemary` via `Rosmarinus officinalis`, `Punica granatum` → `Pomegranate`, etc.) — MediaWiki doesn't follow that chain unless `redirects=1` is passed, which the query was missing. Added it (chaining through both `normalized` and `redirects` response arrays to map the final page title back to the original queried name). **Re-audited with the fix: 112/119 (94%) now get a real Wikipedia thumbnail.** The remaining 7 (`especie-1` Polylepis pauta, `especie-22` Cantua buxifolia alba, `especie-23` Diplostephium venezuelense, `especie-24` Festuca orthophylla, `especie-75` Mimosa quitensis, `especie-85` Geonoma deversa — all well-formed binomials for genuinely obscure Andean/Amazonian species with no English Wikipedia coverage; plus `wira-wira`) now correctly fall through to the Pexels stock photo instead of the placeholder.
  - **Separate data-quality issue, not an image-source problem:** `wira-wira`'s `scientificName` is `"Gnaphalium d. S."` — not a well-formed binomial (`"d. S."` looks like a mangled/truncated author-citation fragment). Pre-existing in the catalog data itself; flagging rather than guessing a replacement, since the correct actual species name isn't verifiable from context alone.
- `[postMerge]` in `.replit` (which runs `scripts/post-merge.sh`, doing `pnpm install --frozen-lockfile`) only fires on `git merge` inside an existing Repl — **not** on a fresh "Import from GitHub". A fresh import skips it entirely, so each service's `[services.development].run` in its `artifact.toml` is prefixed with `pnpm install --frozen-lockfile &&` as a second safety net. If dependencies are genuinely out of sync with the lockfile, this fails loudly with pnpm's own error instead of silently trying to run a missing binary (e.g. `vite: not found`).
- `.replit` declares `modules = ["nodejs-24", ...]`, but a Repl imported from this GitHub repo has been observed actually running Node 20.20.0 instead (cause unconfirmed — possibly the `nodejs-24` Nix module not resolving on import, or the Repl needing a rebuild). Because of this, avoid Node-version-specific CLI flags anywhere a script might run under whatever Node the Repl actually has: api-server previously used `node --env-file-if-exists=.env` to load a local `.env` (only needed outside Replit, where secrets come from env vars directly), but that flag isn't available on Node 20.20.0 and crashed `pnpm run dev`/`start` with `ELIFECYCLE`/`ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL`. Fixed by loading `.env` manually in `src/index.ts` (plain `fs`/`path`, no CLI flag, works on any Node version) instead.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
