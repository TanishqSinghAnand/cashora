import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "./schema";

const databaseUrl = process.env.DATABASE_URL;

// NODE_ENV is "production" during `next build` too (Next.js imports every
// route module to collect page data), not just at runtime — so this must
// not throw during the build phase, only when actually serving a request
// without a configured database.
const isBuildPhase = process.env.NEXT_PHASE === "phase-production-build";
if (!databaseUrl && process.env.NODE_ENV === "production" && !isBuildPhase) {
  throw new Error("DATABASE_URL is not set");
}

const sql = neon(databaseUrl ?? "postgres://placeholder:placeholder@localhost:5432/placeholder");

export const db = drizzle(sql, { schema });
