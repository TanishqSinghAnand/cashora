import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { collaborators, users } from "@/db/schema";
import { requireUser } from "@/server/auth";
import { getAuthorizedCashbook, assertOwner } from "@/server/permissions";
import { recordAudit } from "@/server/audit";
import { handleApiError } from "@/server/api-utils";

type Params = { params: Promise<{ id: string; userId: string }> };

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const { id, userId } = await params;
    const user = await requireUser();
    const access = await getAuthorizedCashbook(id, user.id);
    assertOwner(access);

    const [removed] = await db
      .select({ user: users })
      .from(collaborators)
      .innerJoin(users, eq(collaborators.userId, users.id))
      .where(and(eq(collaborators.cashbookId, id), eq(collaborators.userId, userId)))
      .limit(1);

    await db.delete(collaborators).where(and(eq(collaborators.cashbookId, id), eq(collaborators.userId, userId)));

    await recordAudit({
      userId: user.id,
      userName: user.name,
      action: "REMOVE_COLLABORATOR",
      entity: "cashbook",
      entityId: id,
      description: `${user.name} removed ${removed?.user.name ?? "a collaborator"} from "${access.cashbook.name}"`,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
