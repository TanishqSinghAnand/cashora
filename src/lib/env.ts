function optional(name: string): string | undefined {
  return process.env[name];
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  databaseUrl: optional("DATABASE_URL"),
  appUrl: optional("NEXT_PUBLIC_APP_URL") ?? "http://localhost:3000",
  googleSheetsId: optional("GOOGLE_SHEETS_ID"),
  googleServiceAccountEmail: optional("GOOGLE_SERVICE_ACCOUNT_EMAIL"),
  googlePrivateKey: optional("GOOGLE_PRIVATE_KEY")?.replace(/\\n/g, "\n"),
};

export const isGoogleSheetsConfigured = Boolean(
  env.googleSheetsId && env.googleServiceAccountEmail && env.googlePrivateKey
);
export const isDatabaseConfigured = Boolean(env.databaseUrl);
