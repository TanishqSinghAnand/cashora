import "server-only";
import { createHash, randomInt } from "crypto";
import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/db";
import { emailOtpCodes } from "@/db/schema";
import { env } from "@/lib/env";
import { sendOtpEmail } from "./mailer";

const OTP_TTL_SECONDS = 10 * 60;
const MAX_VERIFY_ATTEMPTS = 5;
const RESEND_COOLDOWN_SECONDS = 60;

function hashCode(email: string, code: string) {
  // Peppered with AUTH_SECRET so a DB leak alone doesn't expose valid codes.
  return createHash("sha256").update(`${email.toLowerCase()}:${code}:${env.authSecret}`).digest("hex");
}

export class OtpCooldownError extends Error {
  constructor(public retryAfterSeconds: number) {
    super(`Please wait ${retryAfterSeconds}s before requesting another code`);
  }
}

/** Generates a 6-digit OTP, stores its hash, and emails it. */
export async function requestOtp(email: string): Promise<void> {
  const normalized = email.toLowerCase().trim();

  const [recent] = await db
    .select()
    .from(emailOtpCodes)
    .where(eq(emailOtpCodes.email, normalized))
    .orderBy(desc(emailOtpCodes.createdAt))
    .limit(1);

  if (recent) {
    const secondsSinceLast = (Date.now() - recent.createdAt.getTime()) / 1000;
    if (secondsSinceLast < RESEND_COOLDOWN_SECONDS) {
      throw new OtpCooldownError(Math.ceil(RESEND_COOLDOWN_SECONDS - secondsSinceLast));
    }
  }

  const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
  const expiresAt = new Date(Date.now() + OTP_TTL_SECONDS * 1000);

  await db.insert(emailOtpCodes).values({
    email: normalized,
    codeHash: hashCode(normalized, code),
    expiresAt,
  });

  await sendOtpEmail(normalized, code);
}

export type VerifyOtpResult = { ok: true } | { ok: false; reason: "invalid" | "expired" | "too_many_attempts" };

/** Verifies a code against the most recent unconsumed, unexpired OTP for that email. */
export async function verifyOtp(email: string, code: string): Promise<VerifyOtpResult> {
  const normalized = email.toLowerCase().trim();

  const [otp] = await db
    .select()
    .from(emailOtpCodes)
    .where(and(eq(emailOtpCodes.email, normalized), isNull(emailOtpCodes.consumedAt), gt(emailOtpCodes.expiresAt, new Date())))
    .orderBy(desc(emailOtpCodes.createdAt))
    .limit(1);

  if (!otp) return { ok: false, reason: "expired" };
  if (otp.attempts >= MAX_VERIFY_ATTEMPTS) return { ok: false, reason: "too_many_attempts" };

  const matches = hashCode(normalized, code) === otp.codeHash;

  if (!matches) {
    await db.update(emailOtpCodes).set({ attempts: otp.attempts + 1 }).where(eq(emailOtpCodes.id, otp.id));
    return { ok: false, reason: "invalid" };
  }

  await db.update(emailOtpCodes).set({ consumedAt: new Date() }).where(eq(emailOtpCodes.id, otp.id));
  return { ok: true };
}
