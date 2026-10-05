# Cashora

**Track. Share. Stay in sync.**

Cashora is a collaborative digital cashbook. Track cash in and cash out, share
a cashbook with a partner, and keep records synchronized to a Google
Spreadsheet — sign in with a one-time code emailed to you instead of a
password, no third-party login provider involved.

## Features

- **Auth** — self-hosted email OTP sign-in: enter your email, get a 6-digit
  code, enter it. No password, no third-party identity provider — a
  collaborator's access is tied to a verified email address they actually
  received a code at, not just a guessable link.
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
- **Auth:** self-hosted email OTP (nodemailer/SMTP + signed session JWTs)
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
  lib/            # Framework-agnostic helpers (money, env, utils)
  server/         # Server-only logic: auth, otp, mailer, permissions, balance, audit
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
npm run dev
```

Open http://localhost:3000 and sign in with your email. After signing in
once for real, run `npm run db:seed` to attach demo cashbooks to your
account.

### Environment variables

See `.env.example` for the full list with comments. Summary:

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | Yes | Postgres connection string (Neon recommended) |
| `AUTH_SECRET` | Production only | 32+ byte random secret signing session JWTs |
| `NEXT_PUBLIC_APP_URL` | Yes | Public URL of the deployment |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASSWORD` / `SMTP_FROM` | For sign-in | See below |
| `GOOGLE_SHEETS_ID` / `GOOGLE_SERVICE_ACCOUNT_EMAIL` / `GOOGLE_PRIVATE_KEY` | For Sheets sync | See below |

### Database setup

Any Postgres works; Neon is the easiest for a Vercel deployment (serverless,
HTTP driver, generous free tier):

1. Create a project at [neon.tech](https://neon.tech).
2. Copy the pooled connection string into `DATABASE_URL`.
3. Run `npm run db:migrate` to create all tables.
4. Sign in once via the app, then optionally `npm run db:seed` for demo data
   attached to your account.

The app uses the `@neondatabase/serverless` **HTTP** driver, which does not
support interactive transactions (`db.transaction()`) — multi-step writes are
made idempotent via unique indexes instead (see
`src/app/api/invitations/[token]/accept/route.ts` for an example).

## Auth setup (email OTP via SMTP)

No third-party login provider — a dedicated mailbox sends the codes.

1. Use a **dedicated mailbox**, not your personal account (e.g.
   `cashora.noreply@gmail.com`), so you're never handing the app your real
   account's credentials.
2. Every major provider blocks raw-password SMTP login now — you need an
   **App Password** instead. For Gmail: enable 2-Step Verification, then
   Google Account → Security → 2-Step Verification → App Passwords → generate
   one for "Mail". It's a revocable token, not your real password.
3. Set `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=587`, `SMTP_USER` to the full
   address, `SMTP_PASSWORD` to the App Password, and `SMTP_FROM` to how it
   should appear (e.g. `"Cashora <cashora.noreply@gmail.com>"`).
4. No custom domain or DNS records needed — this sends as a real mailbox you
   control, not through a transactional-email API that requires domain
   verification before it'll deliver to arbitrary recipients. Gmail's free
   limit is ~500 sends/day, far more than a small app needs.

How it works end to end (`src/server/otp.ts`, `src/server/mailer.ts`,
`src/server/auth.ts`):

- `/api/auth/otp/request` generates a 6-digit code, stores its SHA-256 hash
  (peppered with `AUTH_SECRET`, never the plaintext code) with a 10-minute
  expiry, and emails it. Rate-limited per IP and per email, plus a 60s resend
  cooldown.
- `/api/auth/otp/verify` checks the code against the stored hash, capping
  wrong guesses at 5 attempts before the code is dead. On success it
  finds-or-creates the `users` row by email and issues a session: a signed
  JWT (`jose`) whose `jti` is also recorded in `authentication_sessions`, so
  sign-out actually revokes it server-side instead of just deleting a cookie.
- This is what makes cashbook invitations trustworthy: every account was
  created by proving control of that exact inbox, so an invitation's email
  must match the accepting session's email (`/api/invitations/[token]/accept`
  enforces this, not just "whoever has the link").

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
5. Deploy.
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
- OTP codes are rate-limited (per-IP and per-email request limits, a resend
  cooldown, and a capped number of verify attempts per code) and stored as
  salted/peppered hashes, never plaintext.
- A user row is only ever created by verifying a code sent to that exact
  inbox — so an invitation's email must match the accepting session's email
  (`/api/invitations/[token]/accept` enforces this).
- Secrets never leave the server: SMTP credentials, Google service account
  credentials, and `AUTH_SECRET` are only ever read in `server/`,
  `services/`, and API route files, never in client components.
