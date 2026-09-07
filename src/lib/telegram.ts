import { createHash, createHmac, timingSafeEqual } from "crypto";
import { env } from "./env";

export interface TelegramAuthPayload {
  id: string;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: string;
  hash: string;
}

const MAX_AUTH_AGE_SECONDS = 60 * 5; // replay protection window

/**
 * Verifies data from the Telegram Login Widget per the official spec:
 * https://core.telegram.org/widgets/login#checking-authorization
 */
export function verifyTelegramAuth(payload: TelegramAuthPayload): { ok: true } | { ok: false; reason: string } {
  if (!env.telegramBotToken) {
    return { ok: false, reason: "Telegram is not configured" };
  }

  const { hash, ...rest } = payload;
  if (!hash) return { ok: false, reason: "Missing hash" };

  const dataCheckString = Object.entries(rest)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  const secretKey = createHash("sha256").update(env.telegramBotToken).digest();
  const computedHash = createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

  const a = Buffer.from(computedHash, "hex");
  const b = Buffer.from(hash, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, reason: "Invalid signature" };
  }

  const authDate = Number(payload.auth_date);
  const ageSeconds = Date.now() / 1000 - authDate;
  if (!Number.isFinite(authDate) || ageSeconds > MAX_AUTH_AGE_SECONDS || ageSeconds < -30) {
    return { ok: false, reason: "Authentication data expired" };
  }

  return { ok: true };
}
