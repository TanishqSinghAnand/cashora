import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { verifyTelegramAuth, type TelegramAuthPayload } from "@/lib/telegram";
import { createSession } from "@/server/auth";
import { checkRateLimit } from "@/server/rate-limit";
import { getClientIp } from "@/server/request";
import { recordAudit } from "@/server/audit";
import { syncUserRow } from "@/services/sheets";
import { handleApiError, jsonError } from "@/server/api-utils";

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const allowed = await checkRateLimit(`telegram-auth:${ip}`, 10, 60);
    if (!allowed) return jsonError("Too many attempts. Please wait a moment.", 429);

    const body = (await req.json()) as TelegramAuthPayload;
    const result = verifyTelegramAuth(body);
    if (!result.ok) return jsonError(result.reason, 401);

    const name = [body.first_name, body.last_name].filter(Boolean).join(" ").trim() || body.username || "Cashora User";

    const [existing] = await db.select().from(users).where(eq(users.telegramId, body.id)).limit(1);

    let userId: string;
    if (existing) {
      userId = existing.id;
      await db
        .update(users)
        .set({
          name,
          telegramUsername: body.username ?? existing.telegramUsername,
          photoUrl: body.photo_url ?? existing.photoUrl,
          lastActiveAt: new Date(),
        })
        .where(eq(users.id, userId));
    } else {
      const [created] = await db
        .insert(users)
        .values({
          name,
          telegramId: body.id,
          telegramUsername: body.username,
          photoUrl: body.photo_url,
        })
        .returning();
      userId = created.id;
    }

    await createSession(userId, { userAgent: req.headers.get("user-agent") ?? undefined, ip });

    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    await recordAudit({
      userId,
      userName: user.name,
      action: "LOGIN",
      entity: "user",
      entityId: userId,
      description: `${user.name} logged in via Telegram`,
    });
    void syncUserRow({
      id: user.id,
      name: user.name,
      email: user.email,
      telegramId: user.telegramId,
      createdAt: user.createdAt.toISOString(),
      lastActiveAt: user.lastActiveAt.toISOString(),
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
