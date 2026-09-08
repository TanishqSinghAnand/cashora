import { config } from "dotenv";
config({ path: ".env.local" });

import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { desc, eq } from "drizzle-orm";
import * as schema from "../src/db/schema";

/**
 * Seeds demo cashbooks onto the most-recently-active real account in the
 * database. Sign in once for real (Google or email OTP) before running this
 * — since auth is Clerk-verified, there's no way to fabricate a fake owner
 * account the way the old Telegram-demo seed did.
 */
async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is not set");
  if (process.env.NODE_ENV === "production") throw new Error("Refusing to seed a production environment");

  const sql = neon(databaseUrl);
  const db = drizzle(sql, { schema });

  const [ownerUser] = await db.select().from(schema.users).orderBy(desc(schema.users.lastActiveAt)).limit(1);
  if (!ownerUser) {
    throw new Error("No users found. Sign in once via the app (Google or email OTP) first, then re-run this script.");
  }

  const [partner] = await db
    .insert(schema.users)
    .values({ name: "Rahul Verma", clerkId: "seed:rahul-verma", email: "rahul.demo@example.com" })
    .onConflictDoNothing({ target: schema.users.clerkId })
    .returning();

  const partnerUser = partner ?? (await db.select().from(schema.users).where(eq(schema.users.clerkId, "seed:rahul-verma")))[0];

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
