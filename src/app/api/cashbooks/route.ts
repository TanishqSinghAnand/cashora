import { NextRequest, NextResponse, after } from "next/server";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/db";
import { cashbooks, collaborators, invitations } from "@/db/schema";
import { requireUser } from "@/server/auth";
import { computeBalance } from "@/server/balance";
import { createCashbookSchema } from "@/validations/cashbook";
import { toMinorUnits } from "@/lib/money";
import { recordAudit } from "@/server/audit";
import { syncCashbookRow, syncCollaboratorRow } from "@/services/sheets";
import { sendInviteEmail } from "@/server/mailer";
import { env, isSmtpConfigured } from "@/lib/env";
import { handleApiError } from "@/server/api-utils";

export async function GET() {
  try {
    const user = await requireUser();

    const owned = await db.select().from(cashbooks).where(eq(cashbooks.ownerId, user.id));

    const shared = await db
      .select({ cashbook: cashbooks })
      .from(collaborators)
      .innerJoin(cashbooks, eq(collaborators.cashbookId, cashbooks.id))
      .where(eq(collaborators.userId, user.id));

    const all = [
      ...owned.map((cb) => ({ cashbook: cb, role: "OWNER" as const })),
      ...shared.map((row) => ({ cashbook: row.cashbook, role: "COLLABORATOR" as const })),
    ];

    const withBalances = await Promise.all(
      all.map(async ({ cashbook, role }) => {
        const balance = await computeBalance(cashbook.id, cashbook.initialBalanceMinor);
        return { ...cashbook, role, balance };
      })
    );

    return NextResponse.json({ cashbooks: withBalances });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const input = createCashbookSchema.parse(await req.json());

    const [created] = await db
      .insert(cashbooks)
      .values({
        name: input.name,
        description: input.description || null,
        category: input.category || null,
        currency: input.currency,
        initialBalanceMinor: toMinorUnits(input.initialBalance),
        ownerId: user.id,
      })
      .returning();

    await recordAudit({
      userId: user.id,
      userName: user.name,
      action: "CREATE_CASHBOOK",
      entity: "cashbook",
      entityId: created.id,
      description: `${user.name} created cashbook "${created.name}"`,
    });

    after(
      syncCashbookRow({
        id: created.id,
        name: created.name,
        ownerId: user.id,
        ownerName: user.name,
        currency: created.currency,
        initialBalance: created.initialBalanceMinor,
        currentBalance: created.initialBalanceMinor,
        createdAt: created.createdAt.toISOString(),
        updatedAt: created.updatedAt.toISOString(),
      })
    );

    if (input.collaboratorEmail) {
      const token = nanoid(32);
      const [invitation] = await db
        .insert(invitations)
        .values({
          cashbookId: created.id,
          invitedBy: user.id,
          email: input.collaboratorEmail,
          permission: "EDIT",
          token,
        })
        .returning();

      await recordAudit({
        userId: user.id,
        userName: user.name,
        action: "INVITE_COLLABORATOR",
        entity: "invitation",
        entityId: invitation.id,
        description: `${user.name} invited ${input.collaboratorEmail} to "${created.name}"`,
      });

      after(
        syncCollaboratorRow({
          cashbookId: created.id,
          cashbookName: created.name,
          owner: user.name,
          collaborator: input.collaboratorEmail,
          collaboratorEmail: input.collaboratorEmail,
          permission: "EDIT",
          status: "PENDING",
          invitedAt: invitation.createdAt.toISOString(),
          acceptedAt: "",
        })
      );

      if (isSmtpConfigured) {
        after(
          sendInviteEmail(input.collaboratorEmail, {
            inviterName: user.name,
            cashbookName: created.name,
            inviteLink: `${env.appUrl}/invite/${token}`,
            permission: "EDIT",
          }).catch((err) => console.error("[invite] failed to send invite email", err))
        );
      }
    }

    return NextResponse.json({ cashbook: created }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
