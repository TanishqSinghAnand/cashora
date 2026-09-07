import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { cashbooks, collaborators } from "@/db/schema";
import { requireUser } from "@/server/auth";
import { computeBalance } from "@/server/balance";
import { createCashbookSchema } from "@/validations/cashbook";
import { toMinorUnits } from "@/lib/money";
import { recordAudit } from "@/server/audit";
import { syncCashbookRow } from "@/services/sheets";
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

    void syncCashbookRow({
      id: created.id,
      name: created.name,
      ownerId: user.id,
      ownerName: user.name,
      currency: created.currency,
      initialBalance: created.initialBalanceMinor,
      currentBalance: created.initialBalanceMinor,
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString(),
    });

    return NextResponse.json({ cashbook: created }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
