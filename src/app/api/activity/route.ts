import { NextResponse } from "next/server";
import { desc, eq, inArray, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { auditLogs } from "@/db/schema";
import { requireUser } from "@/server/auth";
import { getAccessibleCashbookIds } from "@/server/accessible-cashbooks";
import { handleApiError } from "@/server/api-utils";

export async function GET() {
  try {
    const user = await requireUser();
    const cashbookIds = await getAccessibleCashbookIds(user.id);

    const conditions: SQL[] = [eq(auditLogs.userId, user.id)];
    if (cashbookIds.length > 0) {
      conditions.push(inArray(auditLogs.entityId, cashbookIds));
      conditions.push(sql`${auditLogs.metadata} ->> 'cashbookId' = any(${cashbookIds})`);
    }

    const rows = await db
      .select()
      .from(auditLogs)
      .where(or(...conditions))
      .orderBy(desc(auditLogs.createdAt))
      .limit(50);

    return NextResponse.json({ activity: rows });
  } catch (err) {
    return handleApiError(err);
  }
}
