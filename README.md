# Cashora

**Track. Share. Stay in sync.**

Cashora is a collaborative digital cashbook. Track cash in and cash out, share
a cashbook with a partner, and keep records synchronized to a Google
Spreadsheet — all with Telegram-based identity verification instead of
passwords.

## Features

- **Telegram login** — real Telegram Login Widget verification (HMAC-SHA256
  per Telegram's official spec), server-side sessions with DB-backed
  revocation, rate limiting, and replay protection.
- **Cashbooks** — create multiple books (Personal, Shop, Business, ...) with a
  currency and initial balance.
- **Transactions** — cash in / cash out with person, category, notes;
  monetary amounts are stored as integer minor units (paise) to avoid
  floating-point drift; balance is always *computed* from the ledger, never
  mutated directly.
- **Collaboration** — invite a partner by email via a shareable link; owners
  can grant view-only or edit access; every access check happens server-side
  (an unrelated user gets a 403 even if they guess a cashbook ID).
- **Google Sheets sync** — Users, Cashbooks, Transactions, Collaborators, and
  Audit Log tabs kept in sync automatically. Credentials stay server-side;
  the app keeps working if Sheets is temporarily unreachable.
- **Audit log** — every significant action (login, create/edit/delete
  cashbook or transaction, invite/accept/decline/remove collaborator) is
  recorded.
- **Cinematic landing page** — GSAP ScrollTrigger + Framer Motion, with a
  `prefers-reduced-motion` fallback.

## Tech stack

- **Framework:** Next.js 16 (App Router, Turbopack), React 19, TypeScript
- **Styling:** Tailwind CSS v4
- **Database:** Postgres (Neon serverless driver) via Drizzle ORM
- **Validation:** Zod
- **Forms:** react-hook-form + @hookform/resolvers
- **Animation:** Framer Motion, GSAP/ScrollTrigger
- **Charts:** Recharts
- **Data fetching:** SWR (polling-based near-real-time updates)
- **Testing:** Vitest (unit + an integration suite against a real Postgres DB)

## Project structure

```
src/
  app/            # App Router routes (pages + API route handlers)
  components/     # UI components, grouped by feature
  db/             # Drizzle schema + client
  hooks/          # Client-side SWR hooks
  lib/            # Framework-agnostic helpers (money, env, telegram, utils)
  server/         # Server-only logic: auth, permissions, balance, audit
  services/       # External integrations (Google Sheets)
  types/          # Shared TypeScript types
  validations/    # Zod schemas
tests/            # Vitest unit + integration tests
scripts/          # One-off scripts (migrate, seed, Sheets init)
drizzle/          # Generated SQL migrations
```

## Local development

```bash
npm install
cp .env.example .env.local   # fill in the values below
npm run db:migrate           # apply the schema to your Postgres database
npm run db:seed              # optional: demo data (dev only, refuses to run if NODE_ENV=production)
npm run dev
```

Open http://localhost:3000. If `TELEGRAM_BOT_TOKEN`/`TELEGRAM_BOT_USERNAME`
aren't set, the login page falls back to a name-only "development sign-in"
(disabled automatically outside development). If they *are* set, both the
Telegram widget and the dev sign-in are shown side by side, since the
Telegram widget requires a registered production domain and won't render on
`localhost`.

### Environment variables

See `.env.example` for the full list with comments. Summary:

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | Yes | Postgres connection string (Neon recommended) |
| `AUTH_SECRET` | Production only | 32+ byte random secret signing session JWTs |
| `NEXT_PUBLIC_APP_URL` | Yes | Public URL of the deployment |
| `TELEGRAM_BOT_TOKEN` / `TELEGRAM_BOT_USERNAME` | For real login | See below |
| `GOOGLE_SHEETS_ID` / `GOOGLE_SERVICE_ACCOUNT_EMAIL` / `GOOGLE_PRIVATE_KEY` | For Sheets sync | See below |
| `ENABLE_DEMO_AUTH` | No | Set `false` to disable the dev sign-in shortcut |

### Database setup

Any Postgres works; Neon is the easiest for a Vercel deployment (serverless,
HTTP driver, generous free tier):

1. Create a project at [neon.tech](https://neon.tech).
2. Copy the pooled connection string into `DATABASE_URL`.
3. Run `npm run db:migrate` to create all tables.
4. Optionally `npm run db:seed` for demo data.

The app uses the `@neondatabase/serverless` **HTTP** driver, which does not
support interactive transactions (`db.transaction()`) — multi-step writes are
made idempotent via unique indexes instead (see
`src/app/api/invitations/[token]/accept/route.ts` for an example).

## Telegram setup

Cashora uses the official
[Telegram Login Widget](https://core.telegram.org/widgets/login) — no OTPs,
no custom auth invented.

1. Open Telegram, message **@BotFather**.
2. Send `/newbot`, give it a display name, then a username ending in `bot`
   (e.g. `CashoraLoginBot`).
3. BotFather replies with a token — put it in `TELEGRAM_BOT_TOKEN`. Put the
   username (no `@`) in `TELEGRAM_BOT_USERNAME`.
4. **Domain binding (required for the widget to render):** once you have a
   production URL, send BotFather `/setdomain` and give it your Vercel
   domain (e.g. `cashora.vercel.app`). The widget refuses to render on any
   domain that isn't registered this way — this is why `localhost` always
   shows "Bot domain invalid" and why the dev sign-in exists.
5. Test locally with the dev sign-in (no domain needed). Test the real
   widget only after deploying and running `/setdomain`.

The server verifies every login with the HMAC-SHA256 check from Telegram's
spec (`src/lib/telegram.ts`) and rejects stale `auth_date`s (replay
protection).

## Google Sheets setup

1. Create a project in [Google Cloud Console](https://console.cloud.google.com/).
2. Enable the **Google Sheets API** for that project.
3. Create a **Service Account** (IAM & Admin → Service Accounts), then create
   a JSON key for it.
4. From the JSON key: put `client_email` in `GOOGLE_SERVICE_ACCOUNT_EMAIL`
   and `private_key` in `GOOGLE_PRIVATE_KEY` (keep the `\n` escapes literal —
   the app converts them to real newlines at runtime).
5. Create a new Google Sheet, share it with the service account's email
   (Editor access), and put its ID (the long string in the sheet's URL)
   in `GOOGLE_SHEETS_ID`.
6. Run `npm run sheets:init` — this creates the Users / Cashbooks /
   Transactions / Collaborators / Audit Log tabs with headers, and writes a
   test row to Audit Log to confirm the connection works.

Sync is best-effort: every write path calls the relevant `sync*` function in
`src/services/sheets.ts` fire-and-forget, wrapped so a Sheets outage never
breaks the request that triggered it.

## Testing

```bash
npm run typecheck   # tsc --noEmit
npm run lint         # eslint
npm run test         # vitest (unit tests always run; the integration suite
                      # in tests/integration/ requires DATABASE_URL and runs
                      # against that real database, cleaning up after itself)
npm run build        # production build
```

The integration suite exercises balance computation, soft-delete, the
transaction idempotency key, and cashbook authorization — including the IDOR
case (a user who is neither owner nor collaborator gets rejected).

## Deployment (Vercel)

1. Push this repository to GitHub.
2. In Vercel, import the repository (or connect it via the Vercel GitHub
   integration) — this repo has no Vercel-specific config beyond the
   standard Next.js auto-detection.
3. Add all the environment variables from `.env.example` (with real values)
   in the Vercel project's Settings → Environment Variables, for the
   Production environment.
4. Set `NEXT_PUBLIC_APP_URL` to the assigned `*.vercel.app` domain (or your
   custom domain).
5. Deploy. Then run `/setdomain` in BotFather with that same domain so the
   Telegram widget works in production.
6. `npm run db:migrate` needs to be run once against the production database
   (from your machine, pointed at the same `DATABASE_URL` — Vercel doesn't
   run it automatically).

## Security notes

- Every cashbook/transaction API route resolves access through
  `getAuthorizedCashbook()` (`src/server/permissions.ts`) — never trust a
  `cashbookId` from the client without it.
- Sessions are JWTs (`jose`) whose `jti` is also recorded in
  `authentication_sessions`, so logout/revocation actually works (a bare JWT
  check alone can't be revoked before expiry).
- Auth endpoints are rate-limited per IP (`src/server/rate-limit.ts`).
- Telegram login payloads are verified with the official HMAC scheme and a 5
  minute freshness window (replay protection).
- Secrets never leave the server: Google service account credentials and the
  Telegram bot token are only ever read in `server/`, `services/`, and API
  route files, never in client components.
