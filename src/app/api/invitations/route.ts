import { NextResponse } from "next/server";
import { and, eq, or } from "drizzle-orm";
import { db } from "@/db";
import { invitations, cashbooks, users } from "@/db/schema";
import { requireUser } from "@/server/auth";
import { handleApiError } from "@/server/api-utils";

export async function GET() {
  try {
    const user = await requireUser();

    const conditions = user.email
      ? or(eq(invitations.invitedUserId, user.id), eq(invitations.email, user.email))
      : eq(invitations.invitedUserId, user.id);

    const rows = await db
      .select({ invitation: invitations, cashbook: cashbooks, inviter: users })
      .from(invitations)
      .innerJoin(cashbooks, eq(invitations.cashbookId, cashbooks.id))
      .innerJoin(users, eq(invitations.invitedBy, users.id))
      .where(and(eq(invitations.status, "PENDING"), conditions));

    return NextResponse.json({
      invitations: rows.map((r) => ({
        id: r.invitation.id,
        token: r.invitation.token,
        cashbookName: r.cashbook.name,
        inviterName: r.inviter.name,
        permission: r.invitation.permission,
        createdAt: r.invitation.createdAt,
      })),
    });
  } catch (err) {
    return handleApiError(err);
  }
}
