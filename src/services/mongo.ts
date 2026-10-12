import "server-only";
import { getMongoDb } from "@/server/mongo-client";
import { isMongoConfigured } from "@/lib/env";

/**
 * Collections mirror the old Google Sheets tabs 1:1 (Users, Cashbooks,
 * Transactions, Collaborators, Audit Log) so the migration script can copy
 * rows across without reshaping them. `_id` is set to the same natural key
 * the Sheets version upserted on, so repeated syncs overwrite in place
 * instead of accumulating duplicates.
 */
const COLLECTIONS = {
  users: "users",
  cashbooks: "cashbooks",
  transactions: "transactions",
  collaborators: "collaborators",
  auditLog: "audit_log",
} as const;

/**
 * Idempotently ensures indexes exist. Safe to call repeatedly (e.g. from a
 * setup script or on cold start) — createIndex is a no-op if the index is
 * already there.
 */
export async function ensureMongoInitialized(): Promise<void> {
  const db = await getMongoDb();
  if (!db) return;

  await db.collection(COLLECTIONS.collaborators).createIndex({ cashbookId: 1 });
  await db.collection(COLLECTIONS.transactions).createIndex({ cashbookId: 1 });
  await db.collection(COLLECTIONS.auditLog).createIndex({ timestamp: -1 });
}

async function upsertDoc(collectionName: string, id: string, doc: Record<string, unknown>) {
  const db = await getMongoDb();
  if (!db) return;
  await db.collection(collectionName).updateOne({ _id: id } as never, { $set: { ...doc, _id: id } }, { upsert: true });
}

const noopIfUnconfigured =
  <T extends unknown[]>(fn: (...args: T) => Promise<void>) =>
  async (...args: T) => {
    if (!isMongoConfigured) return;
    try {
      await fn(...args);
    } catch (err) {
      console.error(`[mongo] sync failed`, err);
    }
  };

export const syncUserRow = noopIfUnconfigured(
  async (user: { id: string; name: string; email: string | null; createdAt: string; lastActiveAt: string }) => {
    await upsertDoc(COLLECTIONS.users, user.id, {
      name: user.name,
      email: user.email ?? "",
      createdAt: user.createdAt,
      lastActiveAt: user.lastActiveAt,
    });
  }
);

export const syncCashbookRow = noopIfUnconfigured(
  async (cb: {
    id: string;
    name: string;
    ownerId: string;
    ownerName: string;
    currency: string;
    initialBalance: number;
    currentBalance: number;
    createdAt: string;
    updatedAt: string;
  }) => {
    await upsertDoc(COLLECTIONS.cashbooks, cb.id, {
      name: cb.name,
      ownerId: cb.ownerId,
      ownerName: cb.ownerName,
      currency: cb.currency,
      initialBalance: cb.initialBalance,
      currentBalance: cb.currentBalance,
      createdAt: cb.createdAt,
      updatedAt: cb.updatedAt,
    });
  }
);

export const syncTransactionRow = noopIfUnconfigured(
  async (tx: {
    id: string;
    cashbookId: string;
    cashbookName: string;
    type: string;
    amount: number;
    description: string;
    person: string;
    category: string;
    notes: string;
    createdBy: string;
    createdAt: string;
    updatedAt: string;
  }) => {
    await upsertDoc(COLLECTIONS.transactions, tx.id, {
      cashbookId: tx.cashbookId,
      cashbookName: tx.cashbookName,
      type: tx.type,
      amount: tx.amount,
      description: tx.description,
      person: tx.person,
      category: tx.category,
      notes: tx.notes,
      createdBy: tx.createdBy,
      createdAt: tx.createdAt,
      updatedAt: tx.updatedAt,
    });
  }
);

export const syncCollaboratorRow = noopIfUnconfigured(
  async (c: {
    cashbookId: string;
    cashbookName: string;
    owner: string;
    collaborator: string;
    collaboratorEmail: string;
    permission: string;
    status: string;
    invitedAt: string;
    acceptedAt: string;
  }) => {
    const key = `${c.cashbookId}:${c.collaborator}`;
    await upsertDoc(COLLECTIONS.collaborators, key, {
      cashbookId: c.cashbookId,
      cashbookName: c.cashbookName,
      owner: c.owner,
      collaborator: c.collaborator,
      collaboratorEmail: c.collaboratorEmail,
      permission: c.permission,
      status: c.status,
      invitedAt: c.invitedAt,
      acceptedAt: c.acceptedAt,
    });
  }
);

export const syncAuditLog = noopIfUnconfigured(
  async (entry: { timestamp: string; user: string; action: string; entity: string; entityId: string; description: string }) => {
    const db = await getMongoDb();
    if (!db) return;
    await db.collection(COLLECTIONS.auditLog).insertOne({
      timestamp: entry.timestamp,
      user: entry.user,
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entityId,
      description: entry.description,
    });
  }
);
