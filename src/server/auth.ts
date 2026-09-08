import "server-only";
import { auth, currentUser } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { recordAudit } from "./audit";
import { syncUserRow } from "@/services/sheets";

export interface SessionUser {
  id: string;
  name: string;
  email: string | null;
  photoUrl: string | null;
  role: "USER" | "SUPER_ADMIN";
}

/**
 * Clerk owns identity and session cookies entirely — this only maps a
 * verified Clerk session to our own `users` row, creating it on first sight
 * ("lazy sync"). Every field we store (name/email/photo) is Clerk-verified:
 * Google sign-in verifies the email itself; email-code sign-in requires the
 * OTP to be entered correctly before Clerk issues a session at all.
 */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const { userId: clerkId } = await auth();
  if (!clerkId) return null;

  const [existing] = await db.select().from(users).where(eq(users.clerkId, clerkId)).limit(1);
  if (existing) {
    if (Date.now() - existing.lastActiveAt.getTime() > 5 * 60 * 1000) {
      void db.update(users).set({ lastActiveAt: new Date() }).where(eq(users.id, existing.id));
    }
    return toSessionUser(existing);
  }

  const clerkUser = await currentUser();
  if (!clerkUser) return null;

  const email = clerkUser.primaryEmailAddress?.emailAddress ?? clerkUser.emailAddresses[0]?.emailAddress ?? null;
  const name =
    [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ").trim() || email?.split("@")[0] || "Cashora User";

  const [created] = await db
    .insert(users)
    .values({ clerkId, name, email, photoUrl: clerkUser.imageUrl ?? null })
    .onConflictDoUpdate({
      target: users.clerkId,
      set: { name, email, photoUrl: clerkUser.imageUrl ?? null, lastActiveAt: new Date() },
    })
    .returning();

  await recordAudit({
    userId: created.id,
    userName: created.name,
    action: "LOGIN",
    entity: "user",
    entityId: created.id,
    description: `${created.name} signed in for the first time`,
  });
  void syncUserRow({
    id: created.id,
    name: created.name,
    email: created.email,
    createdAt: created.createdAt.toISOString(),
    lastActiveAt: created.lastActiveAt.toISOString(),
  });

  return toSessionUser(created);
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) {
    const err = new Error("Unauthorized");
    err.name = "UnauthorizedError";
    throw err;
  }
  return user;
}

function toSessionUser(row: typeof users.$inferSelect): SessionUser {
  return { id: row.id, name: row.name, email: row.email, photoUrl: row.photoUrl, role: row.role };
}
