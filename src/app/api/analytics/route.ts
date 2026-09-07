import { NextRequest, NextResponse } from "next/server";
import { and, gte, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { transactions } from "@/db/schema";
import { requireUser } from "@/server/auth";
import { getAccessibleCashbookIds } from "@/server/accessible-cashbooks";
import { handleApiError } from "@/server/api-utils";

const RANGE_DAYS: Record<string, number | null> = { "7D": 7, "30D": 30, "90D": 90, ALL: null };

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    const cashbookIds = await getAccessibleCashbookIds(user.id);

    const range = req.nextUrl.searchParams.get("range") ?? "30D";
    const days = range in RANGE_DAYS ? RANGE_DAYS[range] : 30;

    if (cashbookIds.length === 0) {
      return NextResponse.json({ series: [], cashIn: 0, cashOut: 0, count: 0 });
    }

    const conditions = [inArray(transactions.cashbookId, cashbookIds), isNull(transactions.deletedAt)];
    if (days) {
      conditions.push(gte(transactions.occurredAt, new Date(Date.now() - days * 86_400_000)));
    }

    const rows = await db
      .select({
        day: sql<string>`to_char(${transactions.occurredAt}, 'YYYY-MM-DD')`,
        cashIn: sql<number>`coalesce(sum(case when ${transactions.type} = 'CASH_IN' then ${transactions.amountMinor} else 0 end), 0)::bigint`,
        cashOut: sql<number>`coalesce(sum(case when ${transactions.type} = 'CASH_OUT' then ${transactions.amountMinor} else 0 end), 0)::bigint`,
      })
      .from(transactions)
      .where(and(...conditions))
      .groupBy(sql`to_char(${transactions.occurredAt}, 'YYYY-MM-DD')`)
      .orderBy(sql`to_char(${transactions.occurredAt}, 'YYYY-MM-DD')`);

    const cashIn = rows.reduce((sum, r) => sum + Number(r.cashIn), 0);
    const cashOut = rows.reduce((sum, r) => sum + Number(r.cashOut), 0);

    return NextResponse.json({
      series: rows.map((r) => ({ day: r.day, cashIn: Number(r.cashIn), cashOut: Number(r.cashOut) })),
      cashIn,
      cashOut,
      count: rows.length,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
