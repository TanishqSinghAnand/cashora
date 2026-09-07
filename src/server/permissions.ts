import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { cashbooks, collaborators } from "@/db/schema";

export class ForbiddenError extends Error {
  constructor(message = "You do not have access to this cashbook") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export class NotFoundError extends Error {
  constructor(message = "Not found") {
    super(message);
    this.name = "NotFoundError";
  }
}

export type CashbookAccess = {
  cashbook: typeof cashbooks.$inferSelect;
  role: "OWNER" | "COLLABORATOR";
  permission: "VIEW" | "EDIT";
};

/**
 * Central authorization check for cashbook access. Every API route/server
 * action that touches a cashbook (or its transactions) MUST go through this
 * — never trust a cashbookId from the client without it. This is what
 * prevents User A from reading/mutating User B's cashbook via a guessed ID.
 */
export async function getAuthorizedCashbook(cashbookId: string, userId: string): Promise<CashbookAccess> {
  const [cashbook] = await db.select().from(cashbooks).where(eq(cashbooks.id, cashbookId)).limit(1);
  if (!cashbook) throw new NotFoundError("Cashbook not found");

  if (cashbook.ownerId === userId) {
    return { cashbook, role: "OWNER", permission: "EDIT" };
  }

  const [collab] = await db
    .select()
    .from(collaborators)
    .where(and(eq(collaborators.cashbookId, cashbookId), eq(collaborators.userId, userId)))
    .limit(1);

  if (!collab) throw new ForbiddenError();

  return { cashbook, role: "COLLABORATOR", permission: collab.permission };
}

export function assertCanEdit(access: CashbookAccess) {
  if (access.permission !== "EDIT") {
    throw new ForbiddenError("You only have view access to this cashbook");
  }
}

export function assertOwner(access: CashbookAccess) {
  if (access.role !== "OWNER") {
    throw new ForbiddenError("Only the owner can perform this action");
  }
}
