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

- `[postMerge]` in `.replit` (which runs `scripts/post-merge.sh`, doing `pnpm install --frozen-lockfile`) only fires on `git merge` inside an existing Repl — **not** on a fresh "Import from GitHub". A fresh import skips it entirely, so each service's `[services.development].run` in its `artifact.toml` is prefixed with `pnpm install --frozen-lockfile &&` as a second safety net. If dependencies are genuinely out of sync with the lockfile, this fails loudly with pnpm's own error instead of silently trying to run a missing binary (e.g. `vite: not found`).
- `.replit` declares `modules = ["nodejs-24", ...]`, but a Repl imported from this GitHub repo has been observed actually running Node 20.20.0 instead (cause unconfirmed — possibly the `nodejs-24` Nix module not resolving on import, or the Repl needing a rebuild). Because of this, avoid Node-version-specific CLI flags anywhere a script might run under whatever Node the Repl actually has: api-server previously used `node --env-file-if-exists=.env` to load a local `.env` (only needed outside Replit, where secrets come from env vars directly), but that flag isn't available on Node 20.20.0 and crashed `pnpm run dev`/`start` with `ELIFECYCLE`/`ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL`. Fixed by loading `.env` manually in `src/index.ts` (plain `fs`/`path`, no CLI flag, works on any Node version) instead.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
