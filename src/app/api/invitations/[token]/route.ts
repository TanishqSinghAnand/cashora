import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { invitations, cashbooks, users } from "@/db/schema";
import { NotFoundError, ForbiddenError } from "@/server/permissions";
import { handleApiError } from "@/server/api-utils";

type Params = { params: Promise<{ token: string }> };

// Intentionally public (no requireUser()) — someone needs to see which email
// an invite is for *before* signing in, so they can pick the right account.
export async function GET(_req: Request, { params }: Params) {
  try {
    const { token } = await params;

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
      invitedEmail: row.invitation.email,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
