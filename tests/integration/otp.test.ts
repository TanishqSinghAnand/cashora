import { describe, it, expect, beforeEach, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { emailOtpCodes } from "@/db/schema";

vi.mock("@/server/mailer", () => ({
  sendOtpEmail: vi.fn(async () => {}),
}));

const runIntegration = process.env.DATABASE_URL ? describe : describe.skip;

runIntegration("email OTP (integration, real Postgres)", () => {
  const testEmail = `otp-test-${Date.now()}@example.com`;

  beforeEach(async () => {
    await db.delete(emailOtpCodes).where(eq(emailOtpCodes.email, testEmail));
    vi.clearAllMocks();
  });

  async function getSentCode(): Promise<string> {
    const { sendOtpEmail } = await import("@/server/mailer");
    const mock = vi.mocked(sendOtpEmail);
    const call = mock.mock.calls.at(-1);
    if (!call) throw new Error("sendOtpEmail was not called");
    return call[1];
  }

  it("generates and stores a hashed (never plaintext) code", async () => {
    const { requestOtp } = await import("@/server/otp");
    await requestOtp(testEmail);

    const code = await getSentCode();
    expect(code).toMatch(/^\d{6}$/);

    const [row] = await db.select().from(emailOtpCodes).where(eq(emailOtpCodes.email, testEmail));
    expect(row).toBeDefined();
    expect(row.codeHash).not.toBe(code);
    expect(row.codeHash).toMatch(/^[a-f0-9]{64}$/); // sha256 hex digest
  });

  it("rejects resending within the cooldown window", async () => {
    const { requestOtp, OtpCooldownError } = await import("@/server/otp");
    await requestOtp(testEmail);
    await expect(requestOtp(testEmail)).rejects.toThrow(OtpCooldownError);
  });

  it("accepts the correct code and marks it consumed", async () => {
    const { requestOtp, verifyOtp } = await import("@/server/otp");
    await requestOtp(testEmail);
    const code = await getSentCode();

    const result = await verifyOtp(testEmail, code);
    expect(result.ok).toBe(true);

    const [row] = await db.select().from(emailOtpCodes).where(eq(emailOtpCodes.email, testEmail));
    expect(row.consumedAt).not.toBeNull();
  });

  it("rejects a wrong code without consuming the real one", async () => {
    const { requestOtp, verifyOtp } = await import("@/server/otp");
    await requestOtp(testEmail);
    const code = await getSentCode();
    const wrongCode = code === "000000" ? "111111" : "000000";

    const wrongResult = await verifyOtp(testEmail, wrongCode);
    expect(wrongResult).toEqual({ ok: false, reason: "invalid" });

    const rightResult = await verifyOtp(testEmail, code);
    expect(rightResult.ok).toBe(true);
  });

  it("a consumed code cannot be reused", async () => {
    const { requestOtp, verifyOtp } = await import("@/server/otp");
    await requestOtp(testEmail);
    const code = await getSentCode();

    expect((await verifyOtp(testEmail, code)).ok).toBe(true);
    const second = await verifyOtp(testEmail, code);
    expect(second).toEqual({ ok: false, reason: "expired" });
  });

  it("locks out after too many wrong attempts, even with the right code", async () => {
    const { requestOtp, verifyOtp } = await import("@/server/otp");
    await requestOtp(testEmail);
    const code = await getSentCode();
    const wrongCode = code === "000000" ? "111111" : "000000";

    for (let i = 0; i < 5; i++) {
      const result = await verifyOtp(testEmail, wrongCode);
      expect(result.ok).toBe(false);
    }

    const finalAttempt = await verifyOtp(testEmail, code);
    expect(finalAttempt).toEqual({ ok: false, reason: "too_many_attempts" });
  });

  it("rejects an expired code", async () => {
    const { requestOtp, verifyOtp } = await import("@/server/otp");
    await requestOtp(testEmail);
    const code = await getSentCode();

    await db
      .update(emailOtpCodes)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(emailOtpCodes.email, testEmail));

    const result = await verifyOtp(testEmail, code);
    expect(result).toEqual({ ok: false, reason: "expired" });
  });
});
