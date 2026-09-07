import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "./schema";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl && process.env.NODE_ENV === "production") {
  throw new Error("DATABASE_URL is not set");
}

const sql = neon(databaseUrl ?? "postgres://placeholder:placeholder@localhost:5432/placeholder");

export const db = drizzle(sql, { schema });
