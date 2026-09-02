# Canary Backend

Framework-agnostic error-monitoring REST API — Next.js (App Router API
routes) + Prisma + PostgreSQL. Serves the Canary SDK's event ingestion, a
web dashboard, and a mobile app against the same contract.

This repo is a snapshot of the `backend/` workspace from the original
`mini-sentry` monorepo, split out for a standalone Vercel deployment. It
does not share git history with that repo — see `docs/API.md` for the full
REST contract, also served live as a browsable page at
[canary-backend-pi.vercel.app/docs.html](https://canary-backend-pi.vercel.app/docs.html)
(`public/docs.html` — a static export of the same reference, self-hosted
here instead of on a separate Claude Artifact link).

## Requirements

- Node.js 20+
- A PostgreSQL database (local: Docker via `docker-compose.yml`; production: see Deploying below)

## Local development

```bash
docker compose up -d          # starts Postgres on localhost:5433
cp .env.example .env
npm install
npm run db:migrate            # applies migrations
npm run db:seed               # seeds a dev project + prints its API key
npm run dev                   # http://localhost:3000
```

`npm test` runs the unit suite against mocked Prisma; integration tests
(`*.integration.test.ts`) are gated behind `DATABASE_URL` being set and run
automatically as part of `npm test` once the local Postgres container is up.

## Environment variables

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | yes | What the running app connects with. In production, use a **pooled** connection string (e.g. Neon's `-pooler` endpoint) — a serverless deployment can open many concurrent short-lived connections, which a pooler is built for. |
| `DIRECT_URL` | yes | What Prisma migrations (`db:migrate`, `db:deploy`) connect with. Migrations can't run reliably through a transaction-mode pooler, so this must be the **unpooled/direct** connection string. Locally, both vars can point at the same database. |
| `CORS_ALLOWED_ORIGINS` | yes | Comma-separated, exact-match browser origins allowed to call this API cross-origin (e.g. `https://app.yourdomain.com,https://yourdomain.com`). No wildcard support — a Vercel preview deployment's random `*.vercel.app` URL won't match unless added explicitly. |
| `SUPERADMIN_EMAILS` | no | Comma-separated emails promoted to `SUPERADMIN` on their next login/register. Promotion-only — removing an email here never demotes an already-promoted account. Leave unset to grant no superadmin access. |

See `.env.example` for the full annotated list.

## Deploying (Vercel + Neon)

1. **Database**: create a Neon project. Grab both connection strings from
   the Neon dashboard — the pooled one (`-pooler` in the hostname) and the
   direct one.
2. **Vercel project**: import this repo. Set the environment variables
   above (`DATABASE_URL` = pooled, `DIRECT_URL` = direct, plus
   `CORS_ALLOWED_ORIGINS` and `SUPERADMIN_EMAILS`) in the Vercel project
   settings.
3. **Migrations**: run `npm run db:deploy` (which runs
   `prisma migrate deploy`) against the production database once, before or
   right after the first deploy — Vercel's build step does not run
   migrations automatically. This can be run from your own machine with
   `DIRECT_URL` set to the Neon direct connection string.
4. **Build**: Vercel runs `npm run build`, which is
   `prisma generate && next build` — the Prisma client is always
   regenerated fresh at build time, so a stale/missing client from build
   caching isn't a risk.

### Known rough edges in this setup

- **Rate limiting is in-memory, per-process** (`src/lib/rateLimit.ts`) — on
  serverless, each cold-started function instance has its own counter, so
  the effective limit is weaker than the nominal one under concurrent
  traffic. Not a correctness bug, just a known limitation of not running a
  shared store (Redis) — see `docs/API.md`'s Known Limitations section.
- **`CORS_ALLOWED_ORIGINS` has no wildcard support** — Vercel preview
  deployment URLs (`*.vercel.app`) need to be added individually if you want
  a preview build of a frontend to call this API cross-origin.
- **Invitation email and push notifications fall back to logging when
  unconfigured** — `src/lib/email.ts` sends real SMTP mail only when all
  `SMTP_*` vars are set; `src/lib/notification.ts` sends real FCM push only
  when `FIREBASE_SERVICE_ACCOUNT_JSON_BASE64` is set (not yet live-verified
  against a real device). The raw invite token is still returned directly in
  the invitation-creation API response either way, so inviting teammates
  works today regardless of SMTP configuration.

## Full API reference

See [`docs/API.md`](./docs/API.md) for every endpoint's request/response
shape, auth requirements, and error codes — or browse the same content as a
searchable page at
[canary-backend-pi.vercel.app/docs.html](https://canary-backend-pi.vercel.app/docs.html).
