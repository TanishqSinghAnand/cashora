import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { invitations, collaborators, cashbooks, users } from "@/db/schema";
import { requireUser } from "@/server/auth";
import { NotFoundError, ForbiddenError } from "@/server/permissions";
import { recordAudit } from "@/server/audit";
import { syncCollaboratorRow } from "@/services/sheets";
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

    const [cashbook] = await db.select().from(cashbooks).where(eq(cashbooks.id, invitation.cashbookId)).limit(1);
    if (!cashbook) throw new NotFoundError("Cashbook no longer exists");
    if (cashbook.ownerId === user.id) {
      throw new ForbiddenError("You already own this cashbook");
    }

    // The invite is only as good as the email it was sent to — require the
    // accepting session's Clerk-verified email to match. Google/OTP sign-in
    // already guarantees `user.email` is verified, so this is what actually
    // ties "this invitation" to "this specific person", not just "whoever
    // has the link".
    if (invitation.email && user.email && invitation.email.toLowerCase() !== user.email.toLowerCase()) {
      throw new ForbiddenError(
        `This invitation was sent to ${invitation.email}, but you're signed in as ${user.email}. Sign in with that email to accept it.`
      );
    }

    // The neon-http driver has no interactive transaction support, so this
    // relies on the collaborators_unique_idx (cashbookId, userId) unique
    // index for idempotency instead of a transactional read-then-write.
    await db
      .update(invitations)
      .set({ status: "ACCEPTED", invitedUserId: user.id, respondedAt: new Date() })
      .where(eq(invitations.id, invitation.id));

    await db
      .insert(collaborators)
      .values({ cashbookId: invitation.cashbookId, userId: user.id, permission: invitation.permission })
      .onConflictDoNothing();

    const [owner] = await db.select().from(users).where(eq(users.id, cashbook.ownerId)).limit(1);

    await recordAudit({
      userId: user.id,
      userName: user.name,
      action: "ACCEPT_COLLABORATION",
      entity: "cashbook",
      entityId: cashbook.id,
      cashbookId: cashbook.id,
      description: `${user.name} accepted the invitation to "${cashbook.name}"`,
    });

    void syncCollaboratorRow({
      cashbookId: cashbook.id,
      cashbookName: cashbook.name,
      owner: owner?.name ?? "",
      collaborator: user.name,
      collaboratorEmail: invitation.email ?? "",
      permission: invitation.permission,
      status: "ACCEPTED",
      invitedAt: invitation.createdAt.toISOString(),
      acceptedAt: new Date().toISOString(),
    });

    return NextResponse.json({ ok: true, cashbookId: cashbook.id });
  } catch (err) {
    return handleApiError(err);
  }
}
