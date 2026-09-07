import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { invitations } from "@/db/schema";
import { requireUser } from "@/server/auth";
import { NotFoundError, ForbiddenError } from "@/server/permissions";
import { recordAudit } from "@/server/audit";
import { handleApiError } from "@/server/api-utils";

type Params = { params: Promise<{ token: string }> };

export async function POST(_req: Request, { params }: Params) {
  try {
    const { token } = await params;
    const user = await requireUser();

    const [invitation] = await db.select().from(invitations).where(eq(invitations.token, token)).limit(1);
    if (!invitation) throw new NotFoundError("Invitation not found");
    if (invitation.status !== "PENDING") {
      throw new ForbiddenError(`This invitation has already been ${invitation.status.toLowerCase()}`);
    }

    await db
      .update(invitations)
      .set({ status: "DECLINED", invitedUserId: user.id, respondedAt: new Date() })
      .where(eq(invitations.id, invitation.id));

    await recordAudit({
      userId: user.id,
      userName: user.name,
      action: "DECLINE_COLLABORATION",
      entity: "invitation",
      entityId: invitation.id,
      description: `${user.name} declined an invitation`,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
