import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq, gte, ilike, isNull, lte, or } from "drizzle-orm";
import { db } from "@/db";
import { transactions, users } from "@/db/schema";
import { requireUser } from "@/server/auth";
import { getAuthorizedCashbook, assertCanEdit } from "@/server/permissions";
import { createTransactionSchema } from "@/validations/transaction";
import { toMinorUnits } from "@/lib/money";
import { recordAudit } from "@/server/audit";
import { syncTransactionRow } from "@/services/sheets";
import { handleApiError } from "@/server/api-utils";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const user = await requireUser();
    await getAuthorizedCashbook(id, user.id);

    const url = new URL(req.url);
    const type = url.searchParams.get("type");
    const category = url.searchParams.get("category");
    const person = url.searchParams.get("person");
    const search = url.searchParams.get("search");
    const dateFrom = url.searchParams.get("dateFrom");
    const dateTo = url.searchParams.get("dateTo");

    const conditions = [eq(transactions.cashbookId, id), isNull(transactions.deletedAt)];
    if (type === "CASH_IN" || type === "CASH_OUT") conditions.push(eq(transactions.type, type));
    if (category) conditions.push(eq(transactions.category, category));
    if (person) conditions.push(eq(transactions.person, person));
    if (dateFrom) conditions.push(gte(transactions.occurredAt, new Date(dateFrom)));
    if (dateTo) conditions.push(lte(transactions.occurredAt, new Date(dateTo)));
    if (search) {
      conditions.push(
        or(ilike(transactions.description, `%${search}%`), ilike(transactions.person, `%${search}%`), ilike(transactions.notes, `%${search}%`))!
      );
    }

    const rows = await db
      .select({ transaction: transactions, creator: users })
      .from(transactions)
      .innerJoin(users, eq(transactions.createdBy, users.id))
      .where(and(...conditions))
      .orderBy(desc(transactions.occurredAt));

    return NextResponse.json({
      transactions: rows.map((r) => ({ ...r.transaction, createdByName: r.creator.name })),
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const user = await requireUser();
    const access = await getAuthorizedCashbook(id, user.id);
    assertCanEdit(access);

    const input = createTransactionSchema.parse(await req.json());

    if (input.clientRequestId) {
      const [dupe] = await db
        .select()
        .from(transactions)
        .where(
          and(
            eq(transactions.cashbookId, id),
            eq(transactions.createdBy, user.id),
            eq(transactions.clientRequestId, input.clientRequestId)
          )
        )
        .limit(1);
      if (dupe) return NextResponse.json({ transaction: dupe }, { status: 200 });
    }

    const [created] = await db
      .insert(transactions)
      .values({
        cashbookId: id,
        type: input.type,
        amountMinor: toMinorUnits(input.amount),
        person: input.person || null,
        description: input.description || null,
        category: input.category || null,
        notes: input.notes || null,
        occurredAt: input.occurredAt ?? new Date(),
        createdBy: user.id,
        clientRequestId: input.clientRequestId ?? null,
      })
      .returning();

    await recordAudit({
      userId: user.id,
      userName: user.name,
      action: "CREATE_TRANSACTION",
      entity: "transaction",
      entityId: created.id,
      description: `${user.name} recorded ${input.type === "CASH_IN" ? "cash in" : "cash out"} of ${input.amount} on "${access.cashbook.name}"`,
    });

    void syncTransactionRow({
      id: created.id,
      cashbookId: id,
      cashbookName: access.cashbook.name,
      type: created.type,
      amount: created.amountMinor,
      description: created.description ?? "",
      person: created.person ?? "",
      category: created.category ?? "",
      notes: created.notes ?? "",
      createdBy: user.name,
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString(),
    });

    return NextResponse.json({ transaction: created }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
