const isProd = process.env.NODE_ENV === "production";
// NODE_ENV is "production" during `next build` too (Next.js imports every
// route module to collect page data), not just when actually serving
// requests — so build-time module evaluation must not be treated as "prod
// without secrets configured yet".
const isBuildPhase = process.env.NEXT_PHASE === "phase-production-build";

function optional(name: string): string | undefined {
  return process.env[name];
}

function required(name: string, devFallback: string): string {
  const value = process.env[name];
  if (value) return value;
  if (isProd && !isBuildPhase) {
    // Fail loudly at runtime instead of silently running with dev secrets.
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return devFallback;
}

const smtpHost = optional("SMTP_HOST");
const smtpPort = optional("SMTP_PORT");
const smtpUser = optional("SMTP_USER");
const smtpPassword = optional("SMTP_PASSWORD");
const smtpFrom = optional("SMTP_FROM");

/**
 * Builds an RFC 5322-valid From header regardless of how SMTP_FROM was
 * typed (with or without `<email>` brackets). Deliberately always uses the
 * *authenticated* SMTP_USER as the actual From address — Gmail (and most
 * providers) require the From address to match the account you logged in
 * as, or treat a mismatch as a spoofing signal. A malformed or mismatched
 * From header is accepted by the SMTP server (no error) but can get
 * silently spam-filtered for recipients who have no prior relationship
 * with the sender — which looks exactly like "it only works for one email
 * and silently fails for every other one".
 */
export function buildFromHeader(user: string, from: string): string {
  const name = from
    .replace(/<[^>]*>/, "") // strip a bracketed "<email>" if present
    .replace(/\S+@\S+/, "") // strip a bare email token if present (no brackets)
    .replace(/["']/g, "")
    .trim();
  return name ? `"${name}" <${user}>` : user;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  databaseUrl: optional("DATABASE_URL"),
  authSecret: required("AUTH_SECRET", "dev-insecure-secret-do-not-use-in-production"),
  appUrl: optional("NEXT_PUBLIC_APP_URL") ?? "http://localhost:3000",
  smtp:
    smtpHost && smtpPort && smtpUser && smtpPassword && smtpFrom
      ? { host: smtpHost, port: Number(smtpPort), user: smtpUser, password: smtpPassword, from: buildFromHeader(smtpUser, smtpFrom) }
      : null,
  googleSheetsId: optional("GOOGLE_SHEETS_ID"),
  googleServiceAccountEmail: optional("GOOGLE_SERVICE_ACCOUNT_EMAIL"),
  googlePrivateKey: optional("GOOGLE_PRIVATE_KEY")?.replace(/\\n/g, "\n"),
};

export const isSmtpConfigured = Boolean(env.smtp);
export const isGoogleSheetsConfigured = Boolean(
  env.googleSheetsId && env.googleServiceAccountEmail && env.googlePrivateKey
);
export const isDatabaseConfigured = Boolean(env.databaseUrl);
