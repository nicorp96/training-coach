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

### Strava import (optional)

1. Create an API app at <https://www.strava.com/settings/api>. Website: `http://localhost:3000`, Authorization Callback Domain: `localhost` (your domain in production).
2. Put its Client ID and Client Secret into `.env` as `STRAVA_CLIENT_ID` and `STRAVA_CLIENT_SECRET`, then restart `pnpm dev`.
3. In the app: Settings → Strava → Connect. Tempo imports the last 60 days, then new activities on “Sync now”. Read-only: nothing is posted to Strava.

Other commands: `pnpm test` (API integration tests, needs Postgres), `pnpm typecheck`.

## Repo layout

```
apps/web        Next.js web app (Today, Calendar, New training, Strength, Profile & zones, Settings, login)
apps/api        Hono REST API, Better Auth, Drizzle ORM + migrations, tests
packages/core   Shared domain code: sports, exercises, dates, thresholds, Zod API schemas
packages/engine Pure training science (zones), unit-tested
packages/integrations  Activity sources (Strava), behind the ActivitySource port
infra/          Docker Compose for local dev and production (+ Caddy, backups)
docs/           Architecture, hosting options, source design (Claude Design)
```

## Production

`docker compose -f infra/docker-compose.prod.yml --env-file .env up -d --build` runs Postgres, API, web and Caddy.
Set `POSTGRES_PASSWORD`, `APP_URL`, `BETTER_AUTH_SECRET`, `SITE_ADDRESS` and (recommended) `SIGNUP_ALLOWED_EMAILS` in `.env`.
