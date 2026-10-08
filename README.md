# Training Coach

A modern multi-sport personal training coach — plan, train, log, analyze and adapt.
Running and road cycling first; mobile app, AI coach and Garmin/COROS/Wahoo integrations planned.

**Status:** Phase 0 — clickable web prototype (mock data, no backend yet). See [PLAN.md](PLAN.md) for architecture and roadmap, [CLAUDE.md](CLAUDE.md) for conventions.

## Run locally

Requirements: Node 22+, pnpm 10.

```bash
pnpm install
pnpm dev            # http://localhost:3000
```

The prototype keeps your changes (saved trainings, completed exercises, settings) in the browser's localStorage.
Switch between the three demo athletes with the profile button at the bottom of the sidebar.

`pnpm infra:up` starts Postgres, MinIO and Mailpit via Docker for the upcoming API (not needed for the prototype yet).

## Repo layout

```
apps/web        Next.js web app (Today, Calendar, New training, Strength, Settings)
packages/core   Shared domain code: sports registry, exercise library, dates, types
infra/          Local Docker services
docs/design/    Source design from Claude Design (Training Coach v2)
```

Stack (planned): TypeScript monorepo · Next.js · Hono · PostgreSQL/Drizzle · Docker · hosted in the EU (Hetzner, Germany).
