import "server-only";
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
  description: string;
  metadata?: Record<string, unknown>;
}) {
  await db.insert(auditLogs).values({
    userId: entry.userId,
    action: entry.action,
    entity: entry.entity,
    entityId: entry.entityId,
    description: entry.description,
    metadata: entry.metadata,
  });

  // Google Sheets sync is best-effort: never let a spreadsheet outage break the app.
  void syncAuditLog({
    timestamp: new Date().toISOString(),
    user: entry.userName ?? entry.userId ?? "system",
    action: entry.action,
    entity: entry.entity,
    entityId: entry.entityId ?? "",
    description: entry.description,
  }).catch((err) => {
    console.error("[audit] Google Sheets sync failed", err);
  });
}
