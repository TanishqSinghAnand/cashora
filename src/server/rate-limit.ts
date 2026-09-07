import "server-only";
import { and, eq, gt, sql } from "drizzle-orm";
import { db } from "@/db";
import { authRateLimits } from "@/db/schema";

/**
 * Simple fixed-window rate limiter backed by Postgres. Good enough for auth
 * endpoints at Cashora's scale without introducing a Redis dependency.
 */
export async function checkRateLimit(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  const windowStart = new Date(Date.now() - windowSeconds * 1000);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(authRateLimits)
    .where(and(eq(authRateLimits.key, key), gt(authRateLimits.createdAt, windowStart)));

  if (count >= limit) return false;

  await db.insert(authRateLimits).values({ key });
  return true;
}
