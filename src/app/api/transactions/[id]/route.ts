import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { transactions } from "@/db/schema";
import { requireUser } from "@/server/auth";
import { getAuthorizedCashbook, assertCanEdit, ForbiddenError, NotFoundError } from "@/server/permissions";
import { updateTransactionSchema } from "@/validations/transaction";
import { toMinorUnits } from "@/lib/money";
import { recordAudit } from "@/server/audit";
import { syncTransactionRow } from "@/services/sheets";
import { handleApiError } from "@/server/api-utils";

type Params = { params: Promise<{ id: string }> };

async function loadTransactionWithAccess(transactionId: string, userId: string) {
  const [tx] = await db.select().from(transactions).where(eq(transactions.id, transactionId)).limit(1);
  if (!tx || tx.deletedAt) throw new NotFoundError("Transaction not found");

  const access = await getAuthorizedCashbook(tx.cashbookId, userId);
  assertCanEdit(access);

  if (access.role === "COLLABORATOR" && tx.createdBy !== userId) {
    throw new ForbiddenError("You can only edit transactions you created");
  }

  return { tx, access };
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const user = await requireUser();
    const { access } = await loadTransactionWithAccess(id, user.id);

    const input = updateTransactionSchema.parse(await req.json());

    const [updated] = await db
      .update(transactions)
      .set({
        ...(input.type !== undefined ? { type: input.type } : {}),
        ...(input.amount !== undefined ? { amountMinor: toMinorUnits(input.amount) } : {}),
        ...(input.person !== undefined ? { person: input.person || null } : {}),
        ...(input.description !== undefined ? { description: input.description || null } : {}),
        ...(input.category !== undefined ? { category: input.category || null } : {}),
        ...(input.notes !== undefined ? { notes: input.notes || null } : {}),
        ...(input.occurredAt !== undefined ? { occurredAt: input.occurredAt } : {}),
        updatedAt: new Date(),
      })
      .where(eq(transactions.id, id))
      .returning();

    await recordAudit({
      userId: user.id,
      userName: user.name,
      action: "UPDATE_TRANSACTION",
      entity: "transaction",
      entityId: id,
      cashbookId: access.cashbook.id,
      description: `${user.name} updated a transaction on "${access.cashbook.name}"`,
    });

    void syncTransactionRow({
      id: updated.id,
      cashbookId: updated.cashbookId,
      cashbookName: access.cashbook.name,
      type: updated.type,
      amount: updated.amountMinor,
      description: updated.description ?? "",
      person: updated.person ?? "",
      category: updated.category ?? "",
      notes: updated.notes ?? "",
      createdBy: user.name,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    });

    return NextResponse.json({ transaction: updated });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const user = await requireUser();
    const { tx, access } = await loadTransactionWithAccess(id, user.id);

    await db.update(transactions).set({ deletedAt: new Date() }).where(eq(transactions.id, id));

    await recordAudit({
      userId: user.id,
      userName: user.name,
      action: "DELETE_TRANSACTION",
      entity: "transaction",
      entityId: id,
      cashbookId: access.cashbook.id,
      description: `${user.name} deleted a transaction on "${access.cashbook.name}"`,
    });

    return NextResponse.json({ ok: true, transaction: tx });
  } catch (err) {
    return handleApiError(err);
  }
}
