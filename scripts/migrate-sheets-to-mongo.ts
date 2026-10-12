import { config } from "dotenv";
config({ path: ".env.local" });

/**
 * One-time migration: copies whatever is currently sitting in the Google
 * Sheets mirror (Users / Cashbooks / Transactions / Collaborators / Audit
 * Log tabs) into the equivalent MongoDB collections, using the same column
 * layout `src/services/mongo.ts` writes going forward. Safe to re-run — every
 * document is upserted on a deterministic key, so repeat runs overwrite
 * rather than duplicate.
 *
 * Reads Google Sheets directly via googleapis (a devDependency kept only for
 * this script — the app itself no longer talks to Sheets) rather than
 * through the old src/services/sheets.ts, which this migration retires.
 */

const SHEET_NAMES = ["Users", "Cashbooks", "Transactions", "Collaborators", "Audit Log"] as const;

async function main() {
  const sheetsId = process.env.GOOGLE_SHEETS_ID;
  const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  const mongoUri = process.env.MONGODB_URI;
  const mongoDbName = process.env.MONGODB_DB_NAME ?? "cashora";

  if (!sheetsId || !serviceAccountEmail || !privateKey) {
    console.log("Google Sheets isn't configured (missing GOOGLE_SHEETS_ID / GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_PRIVATE_KEY) — nothing to migrate.");
    return;
  }
  if (!mongoUri) {
    console.error("MONGODB_URI is not set — configure Mongo before running this migration.");
    process.exit(1);
  }

  const { google } = await import("googleapis");
  const { MongoClient } = await import("mongodb");

  const auth = new google.auth.JWT({
    email: serviceAccountEmail,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
  const sheets = google.sheets({ version: "v4", auth });

  const mongoClient = new MongoClient(mongoUri);
  await mongoClient.connect();
  const db = mongoClient.db(mongoDbName);

  try {
    for (const sheetName of SHEET_NAMES) {
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetsId,
        range: `${sheetName}!A2:Z`,
      });
      const rows = res.data.values ?? [];
      if (rows.length === 0) {
        console.log(`${sheetName}: no rows — skipping.`);
        continue;
      }

      const collectionName = sheetName === "Audit Log" ? "audit_log" : sheetName.toLowerCase();
      const collection = db.collection(collectionName);
      let migrated = 0;

      for (const row of rows) {
        const doc = rowToDoc(sheetName, row);
        if (!doc) continue;
        await collection.updateOne({ _id: doc._id } as never, { $set: doc }, { upsert: true });
        migrated++;
      }

      console.log(`${sheetName}: migrated ${migrated} row(s) -> ${collectionName}`);
    }

    console.log("Migration complete.");
  } finally {
    await mongoClient.close();
  }
}

function rowToDoc(sheetName: (typeof SHEET_NAMES)[number], row: string[]): (Record<string, unknown> & { _id: string }) | null {
  switch (sheetName) {
    case "Users": {
      const [id, name, email, createdAt, lastActiveAt] = row;
      if (!id) return null;
      return { _id: id, name: name ?? "", email: email ?? "", createdAt: createdAt ?? "", lastActiveAt: lastActiveAt ?? "" };
    }
    case "Cashbooks": {
      const [id, name, ownerId, ownerName, currency, initialBalance, currentBalance, createdAt, updatedAt] = row;
      if (!id) return null;
      return {
        _id: id,
        name: name ?? "",
        ownerId: ownerId ?? "",
        ownerName: ownerName ?? "",
        currency: currency ?? "",
        initialBalance: Number(initialBalance) || 0,
        currentBalance: Number(currentBalance) || 0,
        createdAt: createdAt ?? "",
        updatedAt: updatedAt ?? "",
      };
    }
    case "Transactions": {
      const [id, cashbookId, cashbookName, type, amount, description, person, category, notes, createdBy, createdAt, updatedAt] = row;
      if (!id) return null;
      return {
        _id: id,
        cashbookId: cashbookId ?? "",
        cashbookName: cashbookName ?? "",
        type: type ?? "",
        amount: Number(amount) || 0,
        description: description ?? "",
        person: person ?? "",
        category: category ?? "",
        notes: notes ?? "",
        createdBy: createdBy ?? "",
        createdAt: createdAt ?? "",
        updatedAt: updatedAt ?? "",
      };
    }
    case "Collaborators": {
      const [cashbookId, cashbookName, owner, collaborator, collaboratorEmail, permission, status, invitedAt, acceptedAt] = row;
      if (!cashbookId || !collaborator) return null;
      return {
        _id: `${cashbookId}:${collaborator}`,
        cashbookId,
        cashbookName: cashbookName ?? "",
        owner: owner ?? "",
        collaborator,
        collaboratorEmail: collaboratorEmail ?? "",
        permission: permission ?? "",
        status: status ?? "",
        invitedAt: invitedAt ?? "",
        acceptedAt: acceptedAt ?? "",
      };
    }
    case "Audit Log": {
      const [timestamp, user, action, entity, entityId, description] = row;
      if (!timestamp) return null;
      return {
        _id: `${timestamp}|${user ?? ""}|${action ?? ""}|${entityId ?? ""}`,
        timestamp,
        user: user ?? "",
        action: action ?? "",
        entity: entity ?? "",
        entityId: entityId ?? "",
        description: description ?? "",
      };
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
  });
