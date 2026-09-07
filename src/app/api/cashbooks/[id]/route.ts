import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { cashbooks, collaborators, users } from "@/db/schema";
import { requireUser } from "@/server/auth";
import { getAuthorizedCashbook, assertOwner } from "@/server/permissions";
import { computeBalance } from "@/server/balance";
import { updateCashbookSchema } from "@/validations/cashbook";
import { recordAudit } from "@/server/audit";
import { handleApiError } from "@/server/api-utils";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const user = await requireUser();
    const access = await getAuthorizedCashbook(id, user.id);
    const balance = await computeBalance(id, access.cashbook.initialBalanceMinor);

    const collabRows = await db
      .select({ collaborator: collaborators, user: users })
      .from(collaborators)
      .innerJoin(users, eq(collaborators.userId, users.id))
      .where(eq(collaborators.cashbookId, id));

    const [owner] = await db.select().from(users).where(eq(users.id, access.cashbook.ownerId)).limit(1);

    return NextResponse.json({
      cashbook: access.cashbook,
      role: access.role,
      permission: access.permission,
      balance,
      owner: owner ? { id: owner.id, name: owner.name, photoUrl: owner.photoUrl } : null,
      collaborators: collabRows.map((row) => ({
        id: row.collaborator.id,
        userId: row.user.id,
        name: row.user.name,
        photoUrl: row.user.photoUrl,
        permission: row.collaborator.permission,
      })),
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const user = await requireUser();
    const access = await getAuthorizedCashbook(id, user.id);
    assertOwner(access);

    const input = updateCashbookSchema.parse(await req.json());
    const [updated] = await db
      .update(cashbooks)
      .set({
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description || null } : {}),
        ...(input.category !== undefined ? { category: input.category || null } : {}),
        updatedAt: new Date(),
      })
      .where(eq(cashbooks.id, id))
      .returning();

    await recordAudit({
      userId: user.id,
      userName: user.name,
      action: "UPDATE_CASHBOOK",
      entity: "cashbook",
      entityId: id,
      description: `${user.name} updated cashbook "${updated.name}"`,
    });

    return NextResponse.json({ cashbook: updated });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const user = await requireUser();
    const access = await getAuthorizedCashbook(id, user.id);
    assertOwner(access);

    await db.delete(cashbooks).where(eq(cashbooks.id, id));

    await recordAudit({
      userId: user.id,
      userName: user.name,
      action: "DELETE_CASHBOOK",
      entity: "cashbook",
      entityId: id,
      description: `${user.name} deleted cashbook "${access.cashbook.name}"`,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
