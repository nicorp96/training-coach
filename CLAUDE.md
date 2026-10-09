# CLAUDE.md – Training Coach

Read `PLAN.md` before making architectural changes. If a change contradicts the plan, update `PLAN.md` in the same PR (or add an ADR in `docs/adr/`).

## Product in one line
Multi-sport (run + road cycling first) personal training coach: plan, train, log, analyze, adapt. Web first; mobile, LLM and device integrations later.

## Architecture rules
- **TypeScript monorepo** (pnpm workspaces + Turborepo). Layout: `apps/{web,api,worker,mobile}`, `packages/{core,engine,db,api-client,ui,integrations,ai,config}`.
- **API-first:** all business logic lives behind the Hono REST API (`apps/api`, `/v1`). `apps/web` is a client – no DB access, no domain logic in Next.js server components/actions beyond calling `packages/api-client`.
- **`packages/engine` is pure:** no I/O, no DB, no fetch, no Date.now() (pass time in). Training science (zones, TSS/TRIMP, CTL/ATL/TSB, adaptation rules) goes here and must be unit-tested.
- **`packages/core`** holds Zod schemas and domain types shared by API, web, worker and mobile. Validate every API input/output with these schemas.
- **Sports are data, not branches.** Never `if (sport === 'run')` in UI or API; use the sport/metric registry (`Sport`, `Metric`, `SportMetric`, `ZoneModel`). New sport = seed data + optional engine function.
- **Integrations** implement `ActivitySource` / `WorkoutTarget` ports in `packages/integrations/<vendor>`. `.FIT` upload/export is the baseline that must always work.
- **Adaptation** goes through the `AdaptationStrategy` interface. Every change stores before/after + a human-readable explanation. LLM proposals must pass the same guardrails as rules.
- **LLM** access only via `packages/ai` provider interface (default: Anthropic Claude). Never call an LLM SDK directly from apps.
- **Background work** (imports, metric recalculation, adaptation) runs in `apps/worker` via pg-boss, not in request handlers.

## Data & privacy (GDPR – health data)
- Never log health data (HR, sleep, fatigue, feedback, activity streams) or tokens.
- Every query touching athlete data goes through the policy layer `canAccess(actor, resource, action)`.
- OAuth tokens for integrations are encrypted at rest.
- Hosting and all processors must be EU-based unless explicitly approved and documented.
- Public repo: no secrets in git. Only `.env.example` is committed.

## Conventions
- Node LTS, pnpm, ESM, `strict` TypeScript. No `any` without a comment explaining why.
- DB: Drizzle ORM, snake_case tables/columns, UUID v7 ids, `created_at`/`updated_at` on all tables, migrations via drizzle-kit (never edit applied migrations).
- API: REST, plural nouns, `/v1` prefix, cursor pagination, ISO 8601 dates (UTC in DB, athlete timezone in UI), errors as `{ error: { code, message } }`.
- Units: store SI (meters, seconds, watts, bpm); format in UI. Pace is derived, never stored as text.
- UI: Tailwind + shadcn/ui, design tokens from `packages/ui`; mobile-first; sport colors from the sport registry; all strings through i18n (`en` first, `de` second).
- Tests: Vitest for packages/api, Playwright for key web flows. Engine changes require tests.
- Commits: Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:` …). Small PRs.

## Local development
Everything must run locally before anything goes live:
- `docker compose -f infra/docker-compose.yml up -d` (Postgres, MinIO, Mailpit)
- `pnpm install && pnpm dev`
Production uses the same containers on a Hetzner VPS (Germany) with Caddy.

## Current state (Phase 0 done)
- Exists: `apps/web`, `apps/api`, `packages/core`. Not yet: `packages/db` (schema lives in `apps/api/src/db` until the worker needs it), `apps/worker`, `packages/api-client` (the typed client is `@tc/api/client`, built on `hono/client`).
- Backend design: `docs/architecture/backend.md`. Follow its layering: routes → services → db, with authorization only via `requireAthlete()` in `apps/api/src/policy.ts`.
- Web: server state via TanStack Query hooks in `apps/web/src/lib/queries.ts`; Zustand (`lib/store.ts`) holds UI state only. Never put server data in Zustand.
- Schema changes: edit `apps/api/src/db/schema.ts`, then `pnpm --filter @tc/api db:generate --name <change>`; migrations apply automatically on API start. Add/adjust tests in `apps/api/test`.
- Next.js 16 (App Router) + React 19 + Tailwind v4. Read `apps/web/AGENTS.md` and `node_modules/next/dist/docs/` before using unfamiliar Next APIs.
- Design tokens live in `apps/web/src/app/globals.css` (`@theme`). Use the token classes (`bg-accent`, `text-muted`, `border-line`, …) instead of raw hex values; sport colors come from `SPORTS` in `@tc/core`.

## Design source
Visual design comes from the Claude Design prototype `docs/design/Training Coach v2.dc.html` (app name in the design: "Tempo"). Match the prototype when building screens.
