import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  // Dynamic imports so env vars are loaded before src/lib/env.ts reads process.env.
  const { ensureSheetsInitialized, syncAuditLog } = await import("../src/services/sheets");
  const { isGoogleSheetsConfigured } = await import("../src/lib/env");

  if (!isGoogleSheetsConfigured) {
    console.log("Google Sheets is not configured (missing env vars) — skipping.");
    return;
  }

  console.log("Ensuring sheet tabs + headers exist...");
  await ensureSheetsInitialized();

  console.log("Writing a test audit log row...");
  await syncAuditLog({
    timestamp: new Date().toISOString(),
    user: "system",
    action: "SETUP_CHECK",
    entity: "system",
    entityId: "",
    description: "Cashora Google Sheets sync verified during setup.",
  });

  console.log("Google Sheets sync verified successfully.");
}

main().catch((err) => {
  console.error("Google Sheets verification failed:", err);
  process.exit(1);
});
