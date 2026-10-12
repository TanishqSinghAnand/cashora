import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  // Dynamic imports so env vars are loaded before src/lib/env.ts reads process.env.
  const { ensureMongoInitialized, syncAuditLog } = await import("../src/services/mongo");
  const { isMongoConfigured } = await import("../src/lib/env");

  if (!isMongoConfigured) {
    console.log("MongoDB is not configured (missing MONGODB_URI) — skipping.");
    return;
  }

  console.log("Ensuring Mongo indexes exist...");
  await ensureMongoInitialized();

  console.log("Writing a test audit log document...");
  await syncAuditLog({
    timestamp: new Date().toISOString(),
    user: "system",
    action: "SETUP_CHECK",
    entity: "system",
    entityId: "",
    description: "Cashora MongoDB sync verified during setup.",
  });

  console.log("MongoDB sync verified successfully.");
  process.exit(0);
}

main().catch((err) => {
  console.error("MongoDB verification failed:", err);
  process.exit(1);
});
