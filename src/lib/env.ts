const isProd = process.env.NODE_ENV === "production";

function optional(name: string): string | undefined {
  return process.env[name];
}

function required(name: string, devFallback: string): string {
  const value = process.env[name];
  if (value) return value;
  if (isProd) {
    // Fail loudly in production instead of silently running with dev secrets.
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return devFallback;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  databaseUrl: optional("DATABASE_URL"),
  authSecret: required("AUTH_SECRET", "dev-insecure-secret-do-not-use-in-production"),
  appUrl: optional("NEXT_PUBLIC_APP_URL") ?? "http://localhost:3000",
  telegramBotToken: optional("TELEGRAM_BOT_TOKEN"),
  telegramBotUsername: optional("TELEGRAM_BOT_USERNAME"),
  googleSheetsId: optional("GOOGLE_SHEETS_ID"),
  googleServiceAccountEmail: optional("GOOGLE_SERVICE_ACCOUNT_EMAIL"),
  googlePrivateKey: optional("GOOGLE_PRIVATE_KEY")?.replace(/\\n/g, "\n"),
  demoAuthEnabled: !isProd && optional("ENABLE_DEMO_AUTH") !== "false",
};

export const isTelegramConfigured = Boolean(env.telegramBotToken && env.telegramBotUsername);
export const isGoogleSheetsConfigured = Boolean(
  env.googleSheetsId && env.googleServiceAccountEmail && env.googlePrivateKey
);
export const isDatabaseConfigured = Boolean(env.databaseUrl);
