import { describe, it, expect, beforeAll } from "vitest";
import { createHash, createHmac } from "crypto";

process.env.TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? "test-bot-token";

function sign(payload: Record<string, string>, botToken: string) {
  const dataCheckString = Object.entries(payload)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");
  const secretKey = createHash("sha256").update(botToken).digest();
  return createHmac("sha256", secretKey).update(dataCheckString).digest("hex");
}

describe("verifyTelegramAuth", () => {
  let verifyTelegramAuth: typeof import("@/lib/telegram").verifyTelegramAuth;
  const botToken = process.env.TELEGRAM_BOT_TOKEN!;

  beforeAll(async () => {
    ({ verifyTelegramAuth } = await import("@/lib/telegram"));
  });

  function makePayload(overrides: Partial<Record<string, string>> = {}) {
    const base = { id: "123456", first_name: "Tanishq", auth_date: String(Math.floor(Date.now() / 1000)), ...overrides };
    const hash = overrides.hash ?? sign(base, botToken);
    return { ...base, hash };
  }

  it("accepts a correctly signed, fresh payload", () => {
    const payload = makePayload();
    const result = verifyTelegramAuth(payload);
    expect(result.ok).toBe(true);
  });

  it("rejects a tampered payload (changed id after signing)", () => {
    const payload = makePayload();
    const tampered = { ...payload, id: "999999" };
    const result = verifyTelegramAuth(tampered);
    expect(result.ok).toBe(false);
  });

  it("rejects a payload with a forged hash", () => {
    const payload = makePayload({ hash: "0".repeat(64) });
    const result = verifyTelegramAuth(payload);
    expect(result.ok).toBe(false);
  });

  it("rejects stale auth_date (replay protection)", () => {
    const staleDate = String(Math.floor(Date.now() / 1000) - 3600); // 1 hour old
    const payload = makePayload({ auth_date: staleDate });
    const result = verifyTelegramAuth(payload);
    expect(result.ok).toBe(false);
  });
});
