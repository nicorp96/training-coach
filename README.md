# Training Coach

A modern multi-sport personal training coach — plan, train, log, analyze and adapt.
Running and road cycling first; mobile app, AI coach and Garmin/COROS/Wahoo integrations planned.

**Status:** Phase 0 complete — web app + API + PostgreSQL, running locally. See [PLAN.md](PLAN.md) for the roadmap, [docs/architecture/backend.md](docs/architecture/backend.md) for the backend design, [docs/hosting-options.md](docs/hosting-options.md) for how to run it for real, and [CLAUDE.md](CLAUDE.md) for conventions.

## Run locally

Requirements: Node 22+, pnpm 10, Docker.

```bash
cp .env.example .env                 # then set BETTER_AUTH_SECRET (openssl rand -base64 32)
pnpm install
pnpm infra:up                        # Postgres (+ MinIO, Mailpit) in Docker
pnpm db:seed:demo                    # optional: demo athletes Lena, Jonas, Mia
pnpm dev                             # web http://localhost:3000, API http://localhost:4000
```

Demo login (local only): `demo@tempo.local` / `tempo-demo-1234`. Or create your own account at `/signup`.

Other commands: `pnpm test` (API integration tests, needs Postgres), `pnpm typecheck`.

## Repo layout

```
apps/web        Next.js web app (Today, Calendar, New training, Strength, Settings, login)
apps/api        Hono REST API, Better Auth, Drizzle ORM + migrations, tests
packages/core   Shared domain code: sports, exercises, dates, Zod API schemas
infra/          Docker Compose for local dev and production (+ Caddy, backups)
docs/           Architecture, hosting options, source design (Claude Design)
```

## Production

`docker compose -f infra/docker-compose.prod.yml --env-file .env up -d --build` runs Postgres, API, web and Caddy.
Set `POSTGRES_PASSWORD`, `APP_URL`, `BETTER_AUTH_SECRET`, `SITE_ADDRESS` and (recommended) `SIGNUP_ALLOWED_EMAILS` in `.env`.
