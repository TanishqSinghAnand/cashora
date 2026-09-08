import "server-only";
import { google, sheets_v4 } from "googleapis";
import { env, isGoogleSheetsConfigured } from "@/lib/env";

const SHEET_NAMES = ["Users", "Cashbooks", "Transactions", "Collaborators", "Audit Log"] as const;

const HEADERS: Record<(typeof SHEET_NAMES)[number], string[]> = {
  Users: ["User ID", "Name", "Email", "Created At", "Last Active"],
  Cashbooks: [
    "Cashbook ID",
    "Cashbook Name",
    "Owner ID",
    "Owner Name",
    "Currency",
    "Initial Balance",
    "Current Balance",
    "Created At",
    "Updated At",
  ],
  Transactions: [
    "Transaction ID",
    "Cashbook ID",
    "Cashbook Name",
    "Type",
    "Amount",
    "Description",
    "Person",
    "Category",
    "Notes",
    "Created By",
    "Created At",
    "Updated At",
  ],
  Collaborators: [
    "Cashbook ID",
    "Cashbook Name",
    "Owner",
    "Collaborator",
    "Collaborator Email",
    "Permission",
    "Status",
    "Invited At",
    "Accepted At",
  ],
  "Audit Log": ["Timestamp", "User", "Action", "Entity", "Entity ID", "Description"],
};

let client: sheets_v4.Sheets | null = null;

function getClient(): sheets_v4.Sheets | null {
  if (!isGoogleSheetsConfigured) return null;
  if (client) return client;

  const auth = new google.auth.JWT({
    email: env.googleServiceAccountEmail,
    key: env.googlePrivateKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  client = google.sheets({ version: "v4", auth });
  return client;
}

/**
 * Idempotently ensures all required sheet tabs + header rows exist.
 * Safe to call repeatedly (e.g. from a setup script or on cold start).
 */
export async function ensureSheetsInitialized(): Promise<void> {
  const sheets = getClient();
  if (!sheets) return;

  const spreadsheetId = env.googleSheetsId!;
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const existingTitles = new Set(meta.data.sheets?.map((s) => s.properties?.title));

  const missing = SHEET_NAMES.filter((name) => !existingTitles.has(name));
  if (missing.length > 0) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: missing.map((title) => ({ addSheet: { properties: { title } } })),
      },
    });
  }

  for (const name of SHEET_NAMES) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${name}!A1`,
      valueInputOption: "RAW",
      requestBody: { values: [HEADERS[name]] },
    });
  }
}

async function findRowIndexByKey(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  sheetName: string,
  key: string
): Promise<number | null> {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!A2:A`,
  });
  const rows = res.data.values ?? [];
  const idx = rows.findIndex((row) => row[0] === key);
  return idx === -1 ? null : idx + 2; // +2: header row + 1-indexing
}

async function upsertRow(sheetName: (typeof SHEET_NAMES)[number], key: string, row: (string | number)[]) {
  const sheets = getClient();
  if (!sheets) return;
  const spreadsheetId = env.googleSheetsId!;

  const rowIndex = await findRowIndexByKey(sheets, spreadsheetId, sheetName, key);

  if (rowIndex) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${sheetName}!A${rowIndex}`,
      valueInputOption: "RAW",
      requestBody: { values: [row] },
    });
  } else {
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${sheetName}!A1`,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [row] },
    });
  }
}

const noopIfUnconfigured =
  <T extends unknown[]>(fn: (...args: T) => Promise<void>) =>
  async (...args: T) => {
    if (!isGoogleSheetsConfigured) return;
    try {
      await fn(...args);
    } catch (err) {
      console.error(`[sheets] sync failed`, err);
    }
  };

export const syncUserRow = noopIfUnconfigured(
  async (user: { id: string; name: string; email: string | null; createdAt: string; lastActiveAt: string }) => {
    await upsertRow("Users", user.id, [user.id, user.name, user.email ?? "", user.createdAt, user.lastActiveAt]);
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
    await upsertRow("Cashbooks", cb.id, [
      cb.id,
      cb.name,
      cb.ownerId,
      cb.ownerName,
      cb.currency,
      cb.initialBalance,
      cb.currentBalance,
      cb.createdAt,
      cb.updatedAt,
    ]);
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
    await upsertRow("Transactions", tx.id, [
      tx.id,
      tx.cashbookId,
      tx.cashbookName,
      tx.type,
      tx.amount,
      tx.description,
      tx.person,
      tx.category,
      tx.notes,
      tx.createdBy,
      tx.createdAt,
      tx.updatedAt,
    ]);
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
    await upsertRow("Collaborators", key, [
      c.cashbookId,
      c.cashbookName,
      c.owner,
      c.collaborator,
      c.collaboratorEmail,
      c.permission,
      c.status,
      c.invitedAt,
      c.acceptedAt,
    ]);
  }
);

export const syncAuditLog = noopIfUnconfigured(
  async (entry: { timestamp: string; user: string; action: string; entity: string; entityId: string; description: string }) => {
    const sheets = getClient();
    if (!sheets) return;
    await sheets.spreadsheets.values.append({
      spreadsheetId: env.googleSheetsId!,
      range: "Audit Log!A1",
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: {
        values: [[entry.timestamp, entry.user, entry.action, entry.entity, entry.entityId, entry.description]],
      },
    });
  }
);
