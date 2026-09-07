import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";
import { createSession } from "@/server/auth";
import { env } from "@/lib/env";
import { checkRateLimit } from "@/server/rate-limit";
import { getClientIp } from "@/server/request";
import { recordAudit } from "@/server/audit";
import { handleApiError, jsonError } from "@/server/api-utils";

const demoLoginSchema = z.object({
  name: z.string().trim().min(1).max(80),
});

/**
 * Development-only login shortcut so the app is fully testable before a
 * Telegram bot is configured. Disabled outright in production builds.
 */
export async function POST(req: NextRequest) {
  if (!env.demoAuthEnabled) {
    return jsonError("Not found", 404);
  }

  try {
    const ip = getClientIp(req);
    const allowed = await checkRateLimit(`demo-auth:${ip}`, 20, 60);
    if (!allowed) return jsonError("Too many attempts. Please wait a moment.", 429);

    const { name } = demoLoginSchema.parse(await req.json());
    const telegramId = `demo:${name.toLowerCase().replace(/\s+/g, "-")}`;

    const [existing] = await db.select().from(users).where(eq(users.telegramId, telegramId)).limit(1);

    let userId: string;
    if (existing) {
      userId = existing.id;
      await db.update(users).set({ lastActiveAt: new Date() }).where(eq(users.id, userId));
    } else {
      const [created] = await db.insert(users).values({ name, telegramId }).returning();
      userId = created.id;
    }

    await createSession(userId, { userAgent: req.headers.get("user-agent") ?? undefined, ip });
    await recordAudit({
      userId,
      userName: name,
      action: "LOGIN",
      entity: "user",
      entityId: userId,
      description: `${name} logged in via demo mode`,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
