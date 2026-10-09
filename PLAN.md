# Training Coach – Project Plan

> Status: planning phase · Last updated: 2026-10-08
> Owner: nicorp96 · Repo: `github.com/nicorp96/training-coach` (public)

A modern, multi-sport personal training coach platform. Web first; architected so a
mobile app, LLM features and device integrations (COROS, Garmin, Wahoo) can be added
without a rewrite.

---

## 0. Decisions & assumptions

| Topic | Decision | Source |
|---|---|---|
| Repo | Public GitHub repo `training-coach` | confirmed |
| Hosting | EU only (GDPR, health data); options compared in `docs/hosting-options.md` | confirmed |
| Budget | Very small monthly cost (target ≤ €10/month at launch) | confirmed |
| Rollout | Fully working locally first, then go live | confirmed |
| First users | Owner + partner (2 users); invite-only sign-up | confirmed |
| Backend | See `docs/architecture/backend.md` (Hono + Better Auth + Drizzle/Postgres) | done (Phase 0) |
| Team | Solo developer + Claude Code, part-time | **assumed** |
| UI language | English first, i18n-ready from day 1, German as second locale | **assumed** |
| MVP roles | Athlete (self-coached) fully; Coach/Admin modeled + basic coach view | **assumed** |
| First device | `.FIT` upload first (vendor-neutral), then Garmin → COROS → Wahoo | **assumed** |
| LLM provider | Anthropic Claude via API, behind a provider interface | **assumed** |
| UI design | Based on the Claude Design prototype `Training Coach v2.dc.html` | pending import |

Assumptions marked **assumed** should be confirmed; changing them affects mainly phases and effort, not the architecture.

---

## 1. Open clarifying questions

1. Weekly time budget for development (drives the timeline in §6).
2. Does any coach other than you use the platform in v1 (affects invite/onboarding priority)?
3. Strength exercise content: self-authored, or seed from an open dataset (e.g. `free-exercise-db`, public domain)?
4. Which device do you personally own first? (Determines integration order.)
5. Per-user LLM cost ceiling (e.g. €1/user/month) for v2 planning.

---

## 2. Tech stack

### Recommended: TypeScript monorepo, self-hosted on a small EU VPS

| Layer | Choice | Why |
|---|---|---|
| Language | **TypeScript** everywhere | One language for web, API, mobile, engine; shared types |
| Monorepo | **pnpm workspaces + Turborepo** | Fast, cached builds; clean package boundaries |
| Web | **Next.js (App Router) + React** | Mature, SSR for fast first paint, great DX |
| UI | **Tailwind CSS + shadcn/ui (Radix)**, design tokens in a shared package | Accessible primitives, matches modern clean look; tokens reusable in React Native (NativeWind) |
| Calendar/DnD | **dnd-kit** + custom month/week/day grid | Full control over planned vs. done rendering, sport colors |
| Charts | **Recharts** (web) / Victory Native later | Simple, themeable |
| API | **Hono** (standalone `apps/api`) with **Zod**-validated routes → **OpenAPI** spec | Runtime-agnostic, tiny, typed client for web *and* mobile; API is not tied to Next.js |
| Typed client | Generated from OpenAPI (or `hono/client`) in `packages/api-client` | Same client in web and Expo |
| DB | **PostgreSQL 16** | Relational data, JSONB for flexible workout structures, strong ecosystem |
| ORM | **Drizzle ORM** + drizzle-kit migrations | SQL-first, lightweight, typed |
| Auth | **Better Auth** (self-hosted, email+password, magic link, OAuth later) | No vendor lock-in, data stays in EU DB, works with Expo |
| Background jobs | **pg-boss** (queue in Postgres) | No Redis needed → cheaper; used for imports, load recalculation, adaptation runs |
| File storage | S3-compatible: **MinIO** locally, **Hetzner Object Storage** in prod | FIT files, exercise media |
| Mobile (later) | **Expo / React Native** | Reuses `core`, `engine`, `api-client`, design tokens |
| LLM (later) | Anthropic Claude via `packages/ai` provider interface | Swappable; tool-use maps onto our domain API |
| Testing | Vitest (unit), Playwright (e2e) | |
| Local dev | **Docker Compose** (Postgres, MinIO, Mailpit) | Fully offline-capable local stack |
| Prod hosting | **Hetzner Cloud CX22** (Nuremberg/Falkenstein) + Docker Compose + **Caddy** (auto-HTTPS) | ~€4–5/month, German data center |
| Backups | Nightly `pg_dump` → Hetzner Object Storage / Storage Box | ~€1–3/month |
| CI/CD | GitHub Actions → build images → deploy via SSH | Free for public repos |

**Estimated cost at launch:** VPS €4.5 + storage/backups €1–3 + domain ~€1 → **≈ €7–9/month**.

### Alternative A: Supabase (Frankfurt) + Vercel
- Managed Postgres + Auth + Storage, free tier; Next.js on Vercel (functions pinned to `fra1`).
- ➕ zero ops, generous free tier, fast start.
- ➖ free projects pause after inactivity; Vercel is a US company (DPA/SCCs needed); background jobs and long-running imports are awkward on serverless; harder to move later.

### Alternative B: Fly.io / Railway (EU regions)
- ➕ simple container deploys, managed Postgres.
- ➖ costs grow faster (~€15–30/month realistically); still US-based providers.

**Why the recommendation:** cheapest predictable cost, data physically in Germany under an EU provider, identical Docker setup locally and in production ("works locally, then go live" is literally the same compose file).

---

## 3. System architecture

```
                ┌──────────────┐        ┌──────────────┐
                │  Web (Next)  │        │ Mobile (Expo)│  (v3)
                └──────┬───────┘        └──────┬───────┘
                       │  typed api-client (OpenAPI)   │
                       └──────────────┬────────────────┘
                                      ▼
                        ┌──────────────────────────┐
                        │      API (Hono, /v1)     │
                        │  auth · RBAC · validation│
                        └──┬──────────┬─────────┬──┘
                           │          │         │
               ┌───────────▼──┐ ┌─────▼─────┐ ┌─▼──────────────┐
               │ Domain svcs  │ │  Engine   │ │  AI (v2)       │
               │ plans, cal,  │ │ load,zones│ │ provider iface │
               │ workouts,... │ │ adaptation│ │ Claude tools   │
               └──────┬───────┘ └─────┬─────┘ └───────┬────────┘
                      │               │               │
               ┌──────▼───────────────▼───────────────▼─────┐
               │           PostgreSQL (Drizzle)              │
               └──────▲────────────────────────▲─────────────┘
                      │                        │
             ┌────────┴─────────┐   ┌──────────┴─────────────┐
             │ Worker (pg-boss) │◄──│ Integrations adapters  │
             │ imports, metrics │   │ FIT · Garmin · COROS · │
             │ adaptation runs  │   │ Wahoo (webhooks/OAuth) │
             └──────────────────┘   └────────────────────────┘
```

### Principles
- **API-first:** web and mobile are equal clients of the same versioned REST API (`/v1`). No business logic in Next.js server components beyond calling the API.
- **Pure domain packages:** `packages/engine` (training science, adaptation) has zero I/O → unit-testable, runs on server, worker, or device.
- **Ports & adapters for integrations:** each vendor implements `ActivitySource` (import) and/or `WorkoutTarget` (push). FIT upload is just another `ActivitySource`.
- **Pluggable adaptation:** `AdaptationStrategy` interface; MVP = `RuleBasedStrategy`, v2 = `LlmAssistedStrategy` that proposes changes which are validated by the same rule guardrails.
- **Event-driven worker:** `activity.imported` → match to planned session → compute metrics → update load (CTL/ATL/TSB) → run adaptation → notify user.

### API design (excerpt)
REST, JSON, Zod schemas, OpenAPI generated, cursor pagination, ISO dates, all scoped by authenticated user + RBAC.

```
POST   /v1/auth/*                      (Better Auth)
GET    /v1/me                          profile, roles, settings
GET    /v1/athletes/:id/profile        sports, thresholds, availability, equipment
PUT    /v1/athletes/:id/thresholds     FTP, threshold pace, HR max/rest → recompute zones
GET    /v1/athletes/:id/calendar?from&to   planned sessions + activities
PATCH  /v1/sessions/:id                move (date), edit, status
POST   /v1/sessions/:id/complete       mark done + feedback (RPE, feel, sleep, fatigue)
CRUD   /v1/workouts                    structured workout definitions (templates)
CRUD   /v1/plans, /v1/plans/:id/weeks  multi-week plans, phases
CRUD   /v1/goals
CRUD   /v1/exercises                   strength library
GET    /v1/exercises/suggestions?sport&goal&phase
POST   /v1/activities/upload           .FIT upload
GET    /v1/athletes/:id/analytics/load CTL/ATL/TSB series
GET    /v1/athletes/:id/adaptations    proposed/applied changes + explanations
POST   /v1/adaptations/:id/accept|reject
GET    /v1/integrations, POST /v1/integrations/:provider/connect, webhooks /v1/hooks/:provider
```

---

## 4. Data model

### Core entities

```
User ─┬─< Membership >─ Role (athlete | coach | admin)
      └─1 AthleteProfile ─┬─< AthleteSport >─ Sport
                          ├─< Threshold (sport, metric, value, valid_from)
                          ├─< ZoneSet (sport, metric) ─< Zone
                          ├─< Availability (weekday, minutes, sports)
                          └─< Equipment
CoachAthlete (coach_id, athlete_id, status, permissions)

Goal (athlete, type: event|general, sport, date, target) ─< PlanPhase
Plan (athlete|template, goal?) ─< PlanWeek ─< PlannedSession
PlannedSession (date, sport, workout_id?, strength_session_id?, status, order)
Workout (sport, name, structure JSONB, est_duration, est_load, is_template, owner)
StrengthSession ─< StrengthBlock ─< StrengthSet (exercise, reps, weight, rest, rpe)
Exercise (name, muscle_groups[], equipment[], instructions, media, tags: sports/phases)

Activity (athlete, sport, source, start, duration, distance, metrics summary, file_ref)
  ─< ActivityStream (time series: hr, power, pace, cadence, alt) [compressed JSONB / object storage]
  ─ 0..1 PlannedSession (matched)
SessionFeedback (planned_session|activity, rpe, feel, sleep, fatigue, notes)
DailyLoad (athlete, date, sport?, tss, ctl, atl, tsb)
Adaptation (athlete, session_id, type, before JSONB, after JSONB, rule_id|llm, explanation, status)

IntegrationAccount (user, provider, tokens (encrypted), scopes, status)
SyncJob / SyncLog
AuditLog (actor, action, subject, at)
Consent (user, type, version, granted_at, revoked_at)
```

### Multi-sport model (generic)
Sports and metrics are **data, not code branches**:

- `Sport` — `id` (`run`, `ride`, `swim`, `trail_run`, `strength`, …), `family` (endurance/strength), `color`, `default_primary_metric`.
- `Metric` — `id` (`pace`, `power`, `hr`, `cadence`, `speed`), `unit`, `direction` (higher-is-harder or lower-is-harder; pace is inverted).
- `SportMetric` — which metrics a sport supports and which can be workout targets.
- `Threshold` — per athlete × sport × metric (FTP 250 W, threshold pace 4:15/km, LTHR 168), versioned by `valid_from` so history is analyzable.
- `ZoneModel` — named model (e.g. Coggan 7-zone power, Friel 5-zone HR, Daniels pace) with zone boundaries as **% of threshold**; `ZoneSet` is materialized per athlete when thresholds change.
- Workout `structure` is a sport-agnostic tree: `steps[] { type: warmup|interval|recovery|cooldown|repeat, duration|distance, target: { metric, zone | range(% threshold) | absolute } }`.

Adding a new sport = insert `Sport` + `SportMetric` rows + (optionally) a zone model and a load function in the engine registry. No schema migration.

---

## 5. UI/UX concept

Source of truth for visual design: Claude Design prototype **`Training Coach v2.dc.html`** (to be imported into `apps/web` as the first frontend milestone; tokens extracted into `packages/ui`).

### Principles
Mobile-first, responsive; calm, clean, data-dense without clutter; sport color coding everywhere; one primary action per screen; dark mode; WCAG AA; keyboard accessible DnD.

### Navigation
- Desktop: left sidebar — **Today · Calendar · Plan · Workouts · Strength · Analysis · Goals · Settings**; coach gets an **Athletes** switcher at top.
- Mobile: bottom tab bar — Today · Calendar · Plan · Analysis · More.

### Main screens
1. **Today** — today's session card (sport, duration, intensity, zone chart, notes), "Mark done" + quick feedback sheet (RPE slider, feel emoji, sleep, fatigue); week strip; form (TSB) badge; recent adaptation notices ("Why changed?").
2. **Calendar** — month/week/day; planned (outline) vs. completed (filled) vs. missed (muted); sport colors; drag & drop to move; weekly load totals per sport.
3. **Workout builder** — step timeline editor (drag blocks), targets by pace/power/HR zone, live intensity graph, estimated duration/TSS; save as template; duplicate.
4. **Plan** — goal + phase bar (base/build/peak/taper), week-by-week load bars, apply template plan.
5. **Strength** — exercise library (filter by muscle, equipment, sport), session builder (sets/reps/weight/rest), suggestions panel.
6. **Analysis** — CTL/ATL/TSB chart, intensity distribution, planned vs. actual compliance, progress markers (pace@HR, power curve).
7. **Activity detail** — map-less summary (MVP), streams chart, zones time, comparison to planned.
8. **Profile/Settings** — sports, thresholds & zones, availability, equipment, integrations, privacy (export/delete data).
9. **Coach: Athletes** — list with compliance & form indicators, jump into athlete's calendar.

---

## 6. Phased roadmap

Effort assumes solo dev + Claude Code, ~10–15 h/week. "w" = calendar weeks.

### Phase 0 — Foundation (≈2 w)
- Monorepo, tooling, Docker Compose (Postgres, MinIO, Mailpit), CI (lint, typecheck, test).
- DB schema v1 + seed (sports, metrics, zone models, sample exercises).
- Auth (Better Auth), roles, RBAC middleware.
- Import Claude Design prototype → design tokens + app shell.
- ✅ Milestone: `pnpm dev` runs whole stack locally; login works.

### Phase 1 — MVP core (≈6–8 w)
- Profile (sports, thresholds, availability, equipment) + zone calculation.
- Workout builder (run + ride), templates, duplicate.
- Calendar (month/week/day, DnD), Today view, mark done + feedback.
- Goals + plan phases + multi-week plans.
- Strength library + sessions + rule-based suggestions.
- `.FIT` upload → activity → match to planned session.
- ✅ Milestone: you can plan, train and log a full week locally.

### Phase 2 — Analysis & adaptation (≈4–6 w)
- Load metrics (TSS/rTSS/hrTSS/TRIMP), CTL/ATL/TSB, intensity distribution, compliance.
- Progress/stagnation detection.
- Rule-based adaptation engine with explanations, accept/reject UI.
- Export .FIT/.ZWO workouts for manual device upload.
- ✅ Milestone (**go live / MVP**): deploy to Hetzner, backups, privacy pages.

### v2 — Integrations & AI (≈8–12 w)
- Garmin (Activity + Training API), COROS, Wahoo — whichever partner access arrives first.
- LLM: workout generation, exercise suggestions, adaptation proposals, chat coach (Claude).
- Coach features: invite athletes, comments, plan sharing.
- German locale, notifications (email/web push).

### v3 — Mobile & scale (≈8–12 w)
- Expo app (Today, Calendar, feedback, offline cache, push).
- More sports (swim, trail, triathlon multisport sessions).
- Optional: payments for coaches.

---

## 7. Security & privacy (GDPR)

Training, HR and sleep/fatigue data are **health data → GDPR Art. 9 special category**.

- **Legal basis:** explicit consent (Art. 9(2)(a)) collected at sign-up, versioned in `Consent` table, revocable.
- **Data location:** all data in Hetzner Germany; no US processors in MVP. LLM (v2) is opt-in with separate consent; send minimized/pseudonymized context; use Anthropic API with zero-retention settings where available and sign DPA.
- **Auth:** Argon2 password hashing (Better Auth), secure HTTP-only cookies for web, tokens for mobile, optional TOTP 2FA (required for coaches/admins), rate limiting on auth routes.
- **Authorization:** RBAC + resource ownership checks in one policy layer (`canAccess(actor, resource, action)`); coaches only see athletes with an active `CoachAthlete` link and granted scopes.
- **Encryption:** TLS everywhere (Caddy); disk encryption on VPS volume; integration OAuth tokens encrypted at rest (AES-256-GCM, key from env/secret).
- **Data subject rights:** self-service export (JSON + original FIT files) and account deletion (hard delete + backup expiry ≤ 30 days).
- **Logging:** no health data in logs; audit log for access to another user's data.
- **Docs:** privacy policy, imprint (Impressum, required in DE), records of processing, DPAs with Hetzner/Anthropic/vendors.
- **Public repo hygiene:** no secrets in git, `.env.example` only, GitHub secret scanning + Dependabot enabled.

---

## 8. Risks & open questions

| Risk | Impact | Mitigation |
|---|---|---|
| **Garmin Connect Developer Program** requires business application & approval; individual/hobby apps may be rejected or delayed | No auto-sync | `.FIT` upload + `.FIT` workout export from day 1; apply early with live MVP + privacy policy |
| **COROS API** is partner-only (application via COROS, manual review) | Delay | Same fallback; COROS also exports FIT |
| **Wahoo Cloud API** needs developer account + approval for production scopes | Delay | Same fallback |
| Vendor API terms (branding, data retention, no-resell, attribution) | Compliance work | Track per-vendor requirements in `docs/integrations/<vendor>.md` before building |
| Strava as aggregator? API terms (2024) restrict use of data for AI/ML and third-party display | Not a safe shortcut | Avoid as primary source |
| LLM costs grow with chat usage | Budget | Per-user quotas, caching, use smaller model for routine tasks, opt-in only, monthly cap |
| LLM gives unsafe training advice | Injury/trust | LLM proposes, rule engine validates (max ramp rate, rest days, TSB floor); always explain; user accepts |
| Training-science metrics inaccurate without power meter / HR | Bad adaptation | Fallback hierarchy: power → pace → HR → RPE×duration (sRPE) |
| Solo maintainer + ops | Downtime | Simple stack, automated backups, uptime monitor (free tier) |
| Public repo | Leaked secrets | Secret scanning, pre-commit hook, env files ignored |

---

## 9. Project structure

```
training-coach/
├─ apps/
│  ├─ web/                # Next.js app (UI only; talks to API via api-client)
│  ├─ api/                # Hono REST API (/v1), auth, RBAC
│  ├─ worker/             # pg-boss jobs: imports, metrics, adaptation
│  └─ mobile/             # Expo app (v3, placeholder)
├─ packages/
│  ├─ core/               # Zod schemas, domain types, sport/metric registry, constants
│  ├─ engine/             # Pure TS: zones, load (TSS/TRIMP), CTL/ATL/TSB, adaptation rules
│  ├─ db/                 # Drizzle schema, migrations, seed
│  ├─ api-client/         # Typed client generated from OpenAPI
│  ├─ ui/                 # Design tokens + shared React components
│  ├─ integrations/       # ActivitySource/WorkoutTarget ports + fit, garmin, coros, wahoo adapters
│  ├─ ai/                 # LLM provider interface + Claude implementation (v2)
│  └─ config/             # eslint, tsconfig, tailwind presets
├─ infra/
│  ├─ docker-compose.yml        # local: postgres, minio, mailpit
│  ├─ docker-compose.prod.yml   # prod: api, web, worker, postgres, caddy
│  └─ Caddyfile
├─ docs/                  # ADRs, integration research, design import notes
├─ .github/workflows/     # CI + deploy
├─ PLAN.md
├─ CLAUDE.md
└─ README.md
```

---

## 10. Analysis & adaptation engine

### Metrics & models
| Concept | Running | Cycling | Fallback |
|---|---|---|---|
| Intensity factor (IF) | NGP / threshold pace | NP / FTP | avg HR / LTHR |
| Session load | rTSS | TSS = (s × NP × IF) / (FTP × 3600) × 100 | hrTSS / Banister TRIMP / sRPE (RPE × min) |
| Zones | Daniels / % threshold pace | Coggan 7 zones | Friel 5 HR zones |

- **Fitness/Fatigue (Banister impulse–response, PMC):** CTL = 42-day EWMA of daily TSS, ATL = 7-day EWMA, TSB = CTL(yesterday) − ATL(yesterday). Combined across sports, also per sport.
- **Ramp rate:** ΔCTL/week; flag > 5–8 TSS/day/week.
- **ACWR** (acute:chronic workload ratio) as secondary injury-risk signal.
- **Intensity distribution:** % time in Z1–2 / Z3 / Z4+ vs. polarized/pyramidal target per phase.
- **Progress markers:** pace @ fixed HR (aerobic efficiency), efficiency factor (NP/avg HR), decoupling (Pa:HR), best power/pace curves, threshold estimates from hard efforts.
- **Compliance:** planned vs. actual duration/load per session & week.

### MVP: rule-based engine
```
inputs  = { goal, phase, plannedSessions(next 7–14d), activities(last 42d),
            dailyLoad, feedback(last 7d), thresholds, availability }
signals = computeSignals(inputs)   // tsb, rampRate, missedSessions, rpeDelta, fatigueScore, stagnation
for rule in rules (priority-ordered):
    if rule.when(signals, session): proposals += rule.then(session) with explanation
proposals = guardrails(proposals)   // max weekly load change ±15%, ≥1 rest day, keep key sessions
```
Example rules:
- **High fatigue:** TSB < −25 or fatigue ≥ 4/5 for 2 days → convert next intensity session to Z2, −30% duration. *"Your form is −28 and you reported high fatigue twice; today's intervals were changed to an easy ride."*
- **Missed key session:** missed interval session → move to next available day if 48h from next intensity; otherwise drop, don't stack.
- **Too easy:** RPE ≥ 2 below planned on 3 consecutive intensity sessions → +5% targets / suggest threshold retest.
- **Stagnation:** no improvement of pace@HR in 6 weeks during build → suggest varied stimulus (e.g. VO2max block).
- **Taper:** final 7–14 days before event → reduce volume 40–60%, keep intensity.

Rules are data + small pure functions (`id`, `priority`, `when`, `then`, `explain`) in `packages/engine/rules`, unit-tested with fixtures. Every proposal is stored as `Adaptation` with before/after and explanation; user can auto-accept or review.

### LLM extension (v2)
- `AdaptationStrategy` interface: `propose(context) → Proposal[]`.
- `LlmAssistedStrategy` builds a compact context (signals, upcoming week, goal, feedback notes), calls Claude with **tool use** restricted to `modify_session`, `swap_session`, `add_rest_day`, `explain`.
- Output passes through the **same guardrails** as rules; rejected changes are logged.
- Also: natural-language workout generation → validated `Workout.structure` via Zod; chat coach answers grounded in the athlete's data via read-only tools.

---

## 11. Multi-sport data model

See §4 "Multi-sport model". Summary of extension points:

| To add a sport… | Change |
|---|---|
| New sport row | `Sport` seed (id, family, color, icon) |
| Supported metrics | `SportMetric` rows |
| Zones | reuse or add `ZoneModel` (% threshold boundaries) |
| Load calculation | register `loadFn(sport)` in `engine/load/registry.ts` (falls back to hrTSS/sRPE) |
| Workout targets | automatically available via `SportMetric.is_target` |
| Device mapping | adapter maps vendor sport enum → our `Sport.id` |
| Multisport (triathlon) | `PlannedSession` with child segments (`parent_session_id`) |

No migrations needed for a new endurance sport; only seed data + optional engine function.
