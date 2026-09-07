import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { cashbooks, collaborators } from "@/db/schema";

/** Returns the IDs of every cashbook a user can see (owned or collaborated on). */
export async function getAccessibleCashbookIds(userId: string): Promise<string[]> {
  const owned = await db.select({ id: cashbooks.id }).from(cashbooks).where(eq(cashbooks.ownerId, userId));
  const shared = await db.select({ id: collaborators.cashbookId }).from(collaborators).where(eq(collaborators.userId, userId));
  return [...new Set([...owned.map((c) => c.id), ...shared.map((c) => c.id)])];
}
