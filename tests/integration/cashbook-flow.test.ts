import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { nanoid } from "nanoid";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users, cashbooks, transactions, collaborators, invitations } from "@/db/schema";
import { computeBalance } from "@/server/balance";
import { getAuthorizedCashbook, assertCanEdit, ForbiddenError } from "@/server/permissions";
import { toMinorUnits } from "@/lib/money";

const runIntegration = process.env.DATABASE_URL ? describe : describe.skip;

runIntegration("cashbook flow (integration, real Postgres)", () => {
  let ownerId: string;
  let collaboratorId: string;
  let strangerId: string;
  let cashbookId: string;

  beforeAll(async () => {
    const suffix = nanoid(8);
    const [owner] = await db.insert(users).values({ name: "Test Owner", clerkId: `test:owner:${suffix}` }).returning();
    const [collab] = await db.insert(users).values({ name: "Test Collaborator", clerkId: `test:collab:${suffix}` }).returning();
    const [stranger] = await db.insert(users).values({ name: "Test Stranger", clerkId: `test:stranger:${suffix}` }).returning();
    ownerId = owner.id;
    collaboratorId = collab.id;
    strangerId = stranger.id;

    const [cashbook] = await db
      .insert(cashbooks)
      .values({ name: "Integration Test Store", ownerId, currency: "INR", initialBalanceMinor: toMinorUnits(50000) })
      .returning();
    cashbookId = cashbook.id;
  });

  afterAll(async () => {
    // Cascades clean up cashbooks/transactions/collaborators/invitations owned by these users.
    await db.delete(users).where(eq(users.id, ownerId));
    await db.delete(users).where(eq(users.id, collaboratorId));
    await db.delete(users).where(eq(users.id, strangerId));
  });

  it("computes balance as initial + cash in - cash out", async () => {
    await db.insert(transactions).values({ cashbookId, type: "CASH_IN", amountMinor: toMinorUnits(10000), createdBy: ownerId });
    await db.insert(transactions).values({ cashbookId, type: "CASH_OUT", amountMinor: toMinorUnits(2000), createdBy: ownerId });

    const balance = await computeBalance(cashbookId, toMinorUnits(50000));
    expect(balance.currentBalanceMinor).toBe(toMinorUnits(58000));
    expect(balance.cashInMinor).toBe(toMinorUnits(10000));
    expect(balance.cashOutMinor).toBe(toMinorUnits(2000));
  });

  it("excludes soft-deleted transactions from the balance", async () => {
    const [tx] = await db
      .insert(transactions)
      .values({ cashbookId, type: "CASH_OUT", amountMinor: toMinorUnits(99999), createdBy: ownerId })
      .returning();

    const beforeDelete = await computeBalance(cashbookId, toMinorUnits(50000));
    await db.update(transactions).set({ deletedAt: new Date() }).where(eq(transactions.id, tx.id));
    const afterDelete = await computeBalance(cashbookId, toMinorUnits(50000));

    expect(afterDelete.currentBalanceMinor).toBe(beforeDelete.currentBalanceMinor + toMinorUnits(99999));
  });

  it("prevents duplicate transactions via the idempotency key", async () => {
    const clientRequestId = nanoid();
    await db.insert(transactions).values({ cashbookId, type: "CASH_IN", amountMinor: 100, createdBy: ownerId, clientRequestId });

    await expect(
      db.insert(transactions).values({ cashbookId, type: "CASH_IN", amountMinor: 100, createdBy: ownerId, clientRequestId })
    ).rejects.toThrow();
  });

  it("grants the owner full edit access", async () => {
    const access = await getAuthorizedCashbook(cashbookId, ownerId);
    expect(access.role).toBe("OWNER");
    expect(() => assertCanEdit(access)).not.toThrow();
  });

  it("denies access to a user who is neither owner nor collaborator (IDOR protection)", async () => {
    await expect(getAuthorizedCashbook(cashbookId, strangerId)).rejects.toThrow(ForbiddenError);
  });

  it("grants a collaborator access only after being added, respecting their permission", async () => {
    await expect(getAuthorizedCashbook(cashbookId, collaboratorId)).rejects.toThrow(ForbiddenError);

    await db.insert(collaborators).values({ cashbookId, userId: collaboratorId, permission: "VIEW" });
    const access = await getAuthorizedCashbook(cashbookId, collaboratorId);
    expect(access.role).toBe("COLLABORATOR");
    expect(() => assertCanEdit(access)).toThrow(ForbiddenError);

    await db.update(collaborators).set({ permission: "EDIT" }).where(eq(collaborators.userId, collaboratorId));
    const editAccess = await getAuthorizedCashbook(cashbookId, collaboratorId);
    expect(() => assertCanEdit(editAccess)).not.toThrow();
  });

  it("resolves an invitation into a collaborator row on accept", async () => {
    const [invite] = await db
      .insert(invitations)
      .values({ cashbookId, invitedBy: ownerId, email: "invitee@example.com", token: nanoid(32) })
      .returning();

    expect(invite.status).toBe("PENDING");

    await db
      .update(invitations)
      .set({ status: "ACCEPTED", invitedUserId: strangerId, respondedAt: new Date() })
      .where(eq(invitations.id, invite.id));
    await db.insert(collaborators).values({ cashbookId, userId: strangerId, permission: invite.permission });

    const access = await getAuthorizedCashbook(cashbookId, strangerId);
    expect(access.role).toBe("COLLABORATOR");
  });
});
