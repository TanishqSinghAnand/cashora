import { NextRequest, NextResponse } from "next/server";
import { requestOtpSchema } from "@/validations/auth";
import { requestOtp, OtpCooldownError } from "@/server/otp";
import { checkRateLimit } from "@/server/rate-limit";
import { getClientIp } from "@/server/request";
import { isSmtpConfigured } from "@/lib/env";
import { handleApiError, jsonError } from "@/server/api-utils";

export async function POST(req: NextRequest) {
  if (!isSmtpConfigured) {
    return jsonError("Email sign-in isn't configured yet in this environment.", 503);
  }

  try {
    const ip = getClientIp(req);
    const { email } = requestOtpSchema.parse(await req.json());

    // Two layers: per-IP (stop one client hammering many addresses) and
    // per-email (stop spamming one inbox even from different IPs) — on top
    // of requestOtp()'s own 60s resend cooldown.
    const ipOk = await checkRateLimit(`otp-request-ip:${ip}`, 20, 60 * 10);
    if (!ipOk) return jsonError("Too many attempts. Please wait a moment.", 429);
    const emailOk = await checkRateLimit(`otp-request-email:${email}`, 5, 60 * 10);
    if (!emailOk) return jsonError("Too many attempts for this email. Please wait a moment.", 429);

    await requestOtp(email);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof OtpCooldownError) {
      return jsonError(err.message, 429);
    }
    return handleApiError(err);
  }
}
