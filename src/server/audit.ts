import "server-only";
import { after } from "next/server";
import { db } from "@/db";
import { auditLogs } from "@/db/schema";
import { syncAuditLog } from "@/services/sheets";

export type AuditAction =
  | "LOGIN"
  | "CREATE_CASHBOOK"
  | "UPDATE_CASHBOOK"
  | "DELETE_CASHBOOK"
  | "CREATE_TRANSACTION"
  | "UPDATE_TRANSACTION"
  | "DELETE_TRANSACTION"
  | "INVITE_COLLABORATOR"
  | "ACCEPT_COLLABORATION"
  | "DECLINE_COLLABORATION"
  | "REMOVE_COLLABORATOR";

export async function recordAudit(entry: {
  userId: string | null;
  userName?: string;
  action: AuditAction;
  entity: string;
  entityId?: string;
  cashbookId?: string;
  description: string;
  metadata?: Record<string, unknown>;
}) {
  await db.insert(auditLogs).values({
    userId: entry.userId,
    action: entry.action,
    entity: entry.entity,
    entityId: entry.entityId,
    description: entry.description,
    metadata: entry.cashbookId ? { ...entry.metadata, cashbookId: entry.cashbookId } : entry.metadata,
  });

  // Google Sheets sync is best-effort (never let a spreadsheet outage break
  // the app) but still needs after() — on Vercel's serverless runtime an
  // un-awaited promise can be frozen mid-flight the instant the response is
  // sent, so a bare `void promise` here would silently never complete.
  after(
    syncAuditLog({
      timestamp: new Date().toISOString(),
      user: entry.userName ?? entry.userId ?? "system",
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entityId ?? "",
      description: entry.description,
    }).catch((err) => {
      console.error("[audit] Google Sheets sync failed", err);
    })
  );
}
