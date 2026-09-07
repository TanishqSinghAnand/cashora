import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { createHash, randomBytes } from "crypto";
import { eq, and, isNull, gt } from "drizzle-orm";
import { db } from "@/db";
import { authSessions, users } from "@/db/schema";
import { env } from "@/lib/env";

export const SESSION_COOKIE = "cashora_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

function getSecretKey() {
  return new TextEncoder().encode(env.authSecret);
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export interface SessionUser {
  id: string;
  name: string;
  email: string | null;
  telegramId: string;
  telegramUsername: string | null;
  photoUrl: string | null;
  role: "USER" | "SUPER_ADMIN";
}

/**
 * Creates a signed session: a JWT (stateless, fast to verify) whose jti is also
 * recorded server-side in authentication_sessions so it can be revoked/expired
 * from the database (logout everywhere, admin revocation, expiry cleanup).
 */
export async function createSession(userId: string, meta: { userAgent?: string; ip?: string }) {
  const jti = randomBytes(24).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000);

  await db.insert(authSessions).values({
    userId,
    tokenHash: hashToken(jti),
    userAgent: meta.userAgent,
    ipAddress: meta.ip,
    expiresAt,
  });

  const token = await new SignJWT({ sub: userId, jti })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .sign(getSecretKey());

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: env.nodeEnv === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });

  return token;
}

export async function destroySession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  cookieStore.delete(SESSION_COOKIE);
  if (!token) return;

  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    const jti = payload.jti as string | undefined;
    if (jti) {
      await db
        .update(authSessions)
        .set({ revokedAt: new Date() })
        .where(eq(authSessions.tokenHash, hashToken(jti)));
    }
  } catch {
    // token was already invalid; nothing to revoke
  }
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    const jti = payload.jti as string | undefined;
    const userId = payload.sub as string | undefined;
    if (!jti || !userId) return null;

    const [session] = await db
      .select()
      .from(authSessions)
      .where(
        and(
          eq(authSessions.tokenHash, hashToken(jti)),
          isNull(authSessions.revokedAt),
          gt(authSessions.expiresAt, new Date())
        )
      )
      .limit(1);

    if (!session) return null;

    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) return null;

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      telegramId: user.telegramId,
      telegramUsername: user.telegramUsername,
      photoUrl: user.photoUrl,
      role: user.role,
    };
  } catch {
    return null;
  }
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
