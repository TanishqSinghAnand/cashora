import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { invitations, cashbooks, users } from "@/db/schema";
import { requireUser } from "@/server/auth";
import { NotFoundError, ForbiddenError } from "@/server/permissions";
import { handleApiError } from "@/server/api-utils";

type Params = { params: Promise<{ token: string }> };

export async function GET(_req: Request, { params }: Params) {
  try {
    const { token } = await params;
    await requireUser();

    const [row] = await db
      .select({ invitation: invitations, cashbook: cashbooks, inviter: users })
      .from(invitations)
      .innerJoin(cashbooks, eq(invitations.cashbookId, cashbooks.id))
      .innerJoin(users, eq(invitations.invitedBy, users.id))
      .where(eq(invitations.token, token))
      .limit(1);

    if (!row) throw new NotFoundError("Invitation not found");
    if (row.invitation.status !== "PENDING") {
      throw new ForbiddenError(`This invitation has already been ${row.invitation.status.toLowerCase()}`);
    }

    return NextResponse.json({
      cashbookName: row.cashbook.name,
      inviterName: row.inviter.name,
      permission: row.invitation.permission,
      status: row.invitation.status,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
