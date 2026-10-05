import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { invitations, users } from "@/db/schema";
import { requireUser } from "@/server/auth";
import { getAuthorizedCashbook, assertOwner } from "@/server/permissions";
import { createInvitationSchema } from "@/validations/invitation";
import { recordAudit } from "@/server/audit";
import { syncCollaboratorRow } from "@/services/sheets";
import { sendInviteEmail } from "@/server/mailer";
import { env, isSmtpConfigured } from "@/lib/env";
import { handleApiError } from "@/server/api-utils";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const user = await requireUser();
    const access = await getAuthorizedCashbook(id, user.id);
    assertOwner(access);

    const input = createInvitationSchema.parse(await req.json());
    const token = nanoid(32);

    const [invitedUser] = await db.select().from(users).where(eq(users.email, input.email)).limit(1);

    const [invitation] = await db
      .insert(invitations)
      .values({
        cashbookId: id,
        invitedBy: user.id,
        email: input.email,
        permission: input.permission,
        token,
        invitedUserId: invitedUser?.id,
      })
      .returning();

    await recordAudit({
      userId: user.id,
      userName: user.name,
      action: "INVITE_COLLABORATOR",
      entity: "invitation",
      entityId: invitation.id,
      cashbookId: id,
      description: `${user.name} invited ${input.email} to "${access.cashbook.name}"`,
    });

    void syncCollaboratorRow({
      cashbookId: id,
      cashbookName: access.cashbook.name,
      owner: user.name,
      collaborator: invitedUser?.name ?? input.email,
      collaboratorEmail: input.email,
      permission: input.permission,
      status: "PENDING",
      invitedAt: invitation.createdAt.toISOString(),
      acceptedAt: "",
    });

    const inviteLink = `${env.appUrl}/invite/${token}`;

    if (isSmtpConfigured) {
      void sendInviteEmail(input.email, {
        inviterName: user.name,
        cashbookName: access.cashbook.name,
        inviteLink,
        permission: input.permission,
      }).catch((err) => console.error("[invite] failed to send invite email", err));
    }

    return NextResponse.json({ invitation, inviteLink });
  } catch (err) {
    return handleApiError(err);
  }
}
