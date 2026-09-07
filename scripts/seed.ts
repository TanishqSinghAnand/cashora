import { config } from "dotenv";
config({ path: ".env.local" });

import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { eq } from "drizzle-orm";
import * as schema from "../src/db/schema";

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is not set");
  if (process.env.NODE_ENV === "production") throw new Error("Refusing to seed a production environment");

  const sql = neon(databaseUrl);
  const db = drizzle(sql, { schema });

  const [owner] = await db
    .insert(schema.users)
    .values({ name: "Tanishq Singh Anand", telegramId: "demo:tanishq-singh-anand" })
    .onConflictDoNothing({ target: schema.users.telegramId })
    .returning();

  const ownerUser =
    owner ??
    (await db.select().from(schema.users).where(eq(schema.users.telegramId, "demo:tanishq-singh-anand")))[0];

  const [partner] = await db
    .insert(schema.users)
    .values({ name: "Rahul Verma", telegramId: "demo:rahul-verma" })
    .onConflictDoNothing({ target: schema.users.telegramId })
    .returning();

  const partnerUser =
    partner ?? (await db.select().from(schema.users).where(eq(schema.users.telegramId, "demo:rahul-verma")))[0];

  const cashbookDefs = [
    { name: "Personal", category: "Personal", initialBalanceMinor: 1_500_000, description: "Personal daily expenses" },
    { name: "Shop", category: "Business", initialBalanceMinor: 5_000_000, description: "Sharma General Store cash register" },
    { name: "Business", category: "Business", initialBalanceMinor: 10_000_000, description: "Freelance consulting income" },
  ];

  for (const def of cashbookDefs) {
    const [cashbook] = await db
      .insert(schema.cashbooks)
      .values({ ...def, ownerId: ownerUser.id, currency: "INR" })
      .returning();

    const now = Date.now();
    const demoTxs = [
      { type: "CASH_IN" as const, amountMinor: 500_000, person: "Customer", description: "Order payment", category: "Sales", daysAgo: 0 },
      { type: "CASH_OUT" as const, amountMinor: 250_000, person: "Supplier", description: "Stock purchase", category: "Inventory", daysAgo: 1 },
      { type: "CASH_IN" as const, amountMinor: 800_000, person: "Client", description: "Invoice payment", category: "Sales", daysAgo: 3 },
      { type: "CASH_OUT" as const, amountMinor: 120_000, person: "Electricity Board", description: "Utility bill", category: "Utilities", daysAgo: 5 },
      { type: "CASH_OUT" as const, amountMinor: 300_000, person: "Staff", description: "Salary advance", category: "Payroll", daysAgo: 8 },
    ];

    for (const tx of demoTxs) {
      await db.insert(schema.transactions).values({
        cashbookId: cashbook.id,
        type: tx.type,
        amountMinor: tx.amountMinor,
        person: tx.person,
        description: tx.description,
        category: tx.category,
        createdBy: ownerUser.id,
        occurredAt: new Date(now - tx.daysAgo * 86_400_000),
      });
    }

    if (def.name === "Shop" && partnerUser) {
      await db
        .insert(schema.collaborators)
        .values({ cashbookId: cashbook.id, userId: partnerUser.id, permission: "EDIT" })
        .onConflictDoNothing();
    }
  }

  console.log("Seed complete: owner =", ownerUser.name, "| partner =", partnerUser?.name);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
