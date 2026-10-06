import { NextRequest, NextResponse, after } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { verifyOtpSchema } from "@/validations/auth";
import { verifyOtp } from "@/server/otp";
import { getOrCreateUserByEmail, createSession } from "@/server/auth";
import { checkRateLimit } from "@/server/rate-limit";
import { getClientIp } from "@/server/request";
import { recordAudit } from "@/server/audit";
import { syncUserRow } from "@/services/sheets";
import { handleApiError, jsonError } from "@/server/api-utils";

const REASON_MESSAGES: Record<string, string> = {
  invalid: "That code isn't right. Please try again.",
  expired: "This code has expired. Request a new one.",
  too_many_attempts: "Too many incorrect attempts. Request a new code.",
};

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const allowed = await checkRateLimit(`otp-verify-ip:${ip}`, 30, 60 * 10);
    if (!allowed) return jsonError("Too many attempts. Please wait a moment.", 429);

    const { email, code } = verifyOtpSchema.parse(await req.json());

    const result = await verifyOtp(email, code);
    if (!result.ok) {
      return jsonError(REASON_MESSAGES[result.reason], 401);
    }

    const user = await getOrCreateUserByEmail(email);
    await createSession(user.id, { userAgent: req.headers.get("user-agent") ?? undefined, ip });

    await recordAudit({
      userId: user.id,
      userName: user.name,
      action: "LOGIN",
      entity: "user",
      entityId: user.id,
      description: `${user.name} signed in via email code`,
    });
    const [row] = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
    after(
      syncUserRow({
        id: user.id,
        name: user.name,
        email: user.email,
        createdAt: row.createdAt.toISOString(),
        lastActiveAt: row.lastActiveAt.toISOString(),
      })
    );

    return NextResponse.json({ ok: true, user });
  } catch (err) {
    return handleApiError(err);
  }
}
