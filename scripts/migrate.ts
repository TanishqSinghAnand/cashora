import { config } from "dotenv";
config({ path: ".env.local" });

import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { migrate } from "drizzle-orm/neon-http/migrator";

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is not set");

  const sql = neon(databaseUrl);
  const db = drizzle(sql);

  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("Migrations applied successfully.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
