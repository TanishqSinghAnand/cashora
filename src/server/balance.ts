import "server-only";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { transactions } from "@/db/schema";

export interface BalanceSummary {
  initialBalanceMinor: number;
  cashInMinor: number;
  cashOutMinor: number;
  currentBalanceMinor: number;
  transactionCount: number;
}

/**
 * Balance is always derived from the transaction ledger, never mutated
 * directly — this keeps edits/deletes/concurrent writes consistent by
 * construction instead of requiring manual reconciliation.
 */
export async function computeBalance(cashbookId: string, initialBalanceMinor: number): Promise<BalanceSummary> {
  const [row] = await db
    .select({
      cashIn: sql<number>`coalesce(sum(case when ${transactions.type} = 'CASH_IN' then ${transactions.amountMinor} else 0 end), 0)::bigint`,
      cashOut: sql<number>`coalesce(sum(case when ${transactions.type} = 'CASH_OUT' then ${transactions.amountMinor} else 0 end), 0)::bigint`,
      count: sql<number>`count(*)::int`,
    })
    .from(transactions)
    .where(and(eq(transactions.cashbookId, cashbookId), isNull(transactions.deletedAt)));

  const cashInMinor = Number(row?.cashIn ?? 0);
  const cashOutMinor = Number(row?.cashOut ?? 0);

  return {
    initialBalanceMinor,
    cashInMinor,
    cashOutMinor,
    currentBalanceMinor: initialBalanceMinor + cashInMinor - cashOutMinor,
    transactionCount: row?.count ?? 0,
  };
}
