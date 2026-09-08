# Cashora

**Track. Share. Stay in sync.**

Cashora is a collaborative digital cashbook. Track cash in and cash out, share
a cashbook with a partner, and keep records synchronized to a Google
Spreadsheet — sign in with Google or a one-time emailed code instead of a
password.

## Features

- **Auth** — Google sign-in or a one-time emailed code (Clerk), so a
  collaborator's access is always tied to a verified email address, not just
  a guessable link.
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
- **Auth:** Clerk (Google OAuth + email OTP-code sign-in)
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
npm run dev
```

Open http://localhost:3000 and sign in — Clerk's Google/email-OTP sign-in
works on `localhost` with no extra setup (unlike OAuth flows that require a
registered production domain). After signing in once for real, run
`npm run db:seed` to attach demo cashbooks to your account.

### Environment variables

See `.env.example` for the full list with comments. Summary:

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | Yes | Postgres connection string (Neon recommended) |
| `NEXT_PUBLIC_APP_URL` | Yes | Public URL of the deployment |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` / `CLERK_SECRET_KEY` | Yes | See below |
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

## Auth setup (Clerk)

1. Create a free account at [clerk.com](https://clerk.com) and a new
   application.
2. Under **Configure → SSO Connections**, enable **Google**. Clerk's shared
   development credentials work immediately with no Google Cloud setup —
   good enough until you want the consent screen to say "Cashora" instead of
   "Clerk", which needs your own OAuth client from Google Cloud Console.
3. Under **Configure → Email, Phone, Username**, make sure email address is
   enabled with **"Email verification code"** — that's the OTP sign-in path.
4. Copy `Publishable key` and `Secret key` from **Configure → API Keys** into
   `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` / `CLERK_SECRET_KEY`.

Our `/login` page hosts Clerk's `<SignIn/>` component directly (no separate
Clerk-hosted pages, no catch-all route needed — it uses hash-based routing).
`getCurrentUser()` (`src/server/auth.ts`) lazily creates our own `users` row
on first sight of a verified Clerk session — every field we store (name,
email, photo) is Clerk-verified: Google verifies the email itself, and
email-code sign-in requires the OTP to be entered correctly before Clerk
issues a session at all. This is what makes cashbook invitations trustworthy:
an invite is tied to an email address, and only a session with that
*verified* email can accept it.

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
- Sessions and their cookies are entirely managed by Clerk
  (`clerkMiddleware()` in `src/middleware.ts` protects
  `/dashboard`, `/cashbooks`, `/invite`, `/activity`, `/profile`); we only
  ever read the verified `userId`/email Clerk hands us.
- A user row is only ever created from a Clerk-verified session — an
  invitation's email must match the accepting session's verified email in
  spirit (the invite link itself is the credential; anyone signing in and
  opening it can accept, so keep the link as private as an invite).
- Secrets never leave the server: Google service account credentials and the
  Clerk secret key are only ever read in `server/`, `services/`, and API
  route files, never in client components.
