# Hosting & usage options (2 users)

> Researched 2026-10-09. Prices change, so re-check before buying.

Question: we only want to use Tempo as a couple at first. What's the best way to run it?

Important: an "app" is **not** an alternative to a server. Phones (web or native app) need a place where the API and database run. There are two separate choices:
1. **Where the backend runs** (A–D below)
2. **How you open it on the phone** (PWA vs. native app)

## 1. Where the backend runs

| | A. Your Mac only | B. Home server + Tailscale | C. Small EU VPS (Hetzner) | D. Free managed tiers |
|---|---|---|---|---|
| What | `pnpm dev` on the laptop | Raspberry Pi / old laptop / NAS at home running Docker; phones connect via Tailscale private VPN | Cloud server in Germany running the same Docker setup, public HTTPS + login | Supabase (DB/auth) + Vercel (web) |
| Monthly cost | €0 | €0 (+ ~€1 electricity); hardware €0–100 one-off | **~€6** (CX23, 2 vCPU/4 GB) + ~€1.20 backups + ~€1 domain ≈ **€8** | €0 |
| Works from anywhere | ❌ only when Mac is on & same Wi-Fi | ✅ via Tailscale app on both phones (free plan: up to 6 users) | ✅ any browser | ✅ |
| Privacy | ✅ at home | ✅ at home, not reachable from the internet | ✅ German DC, but public endpoint | ⚠️ US companies, free projects **pause after 7 days without activity** |
| Effort to run | none | medium: you own hardware, updates, backups | low: occasional updates, automated backups | low, but our architecture (long-running API, jobs) doesn't fit serverless well |
| Garmin/Wahoo/COROS later | ❌ | ⚠️ webhooks need a public URL (Tailscale Funnel or Cloudflare Tunnel) | ✅ | ⚠️ |
| Verdict | dev only | **best free option** | **best "just works" option** | not recommended |

## 2. How you open it on the phone

| | Progressive Web App (PWA) | Native app (Expo) |
|---|---|---|
| What | Open the site in Safari/Chrome → "Add to Home Screen". Full-screen icon, feels like an app | Real iOS/Android app built from `apps/mobile` (Phase v3) |
| Cost | €0 | Apple Developer Program **$99/year** (needed even for TestFlight), Google Play €25 one-off |
| Distribution to 2 people | send a link | TestFlight (iOS) / internal testing (Android) |
| Push notifications | ✅ web push (iOS 16.4+ when installed to home screen) | ✅ |
| Offline, background sync, watch integrations | limited | ✅ |
| Verdict | **use now** | later, when offline/device features need it |

## Recommendation

1. **This week (free):** run the backend on the Mac with Docker. Install Tailscale on the Mac and both phones and open Tempo as a PWA through the Tailscale address. This tests real use with zero cost and zero exposure.
2. **When you want it always on:**
   - **Option C, Hetzner CX23 in Nuremberg/Falkenstein (~€8/month all-in).** Recommended: always on, nothing to maintain at home, and ready for Garmin/Wahoo webhooks later.
   - Option B, if you already have a spare device at home and prefer €0/month and maximum privacy.
3. **Native app:** only in v3. The PWA covers daily use for two people.

Moving between A → B → C is the same `docker compose` stack plus a database dump/restore, so the first choice doesn't lock you in.

Sources: [Hetzner CX23 pricing](https://www.cloudhim.com/cloud-costs/hetzner-cx22-pricing-2026), [Hetzner 2026 price changes](https://northflank.com/blog/hetzner-cloud-server-price-increases), [Tailscale free plan](https://costbench.com/software/business-vpn/tailscale/free-plan), [Supabase free tier pausing](https://automationatlas.io/answers/supabase-free-tier-limits-2026/), [Apple Developer Program](https://studio.adalo.com/blog/apple-developer-program-guide).
