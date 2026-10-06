import { describe, it, expect } from "vitest";
import { buildFromHeader } from "@/lib/env";

describe("buildFromHeader", () => {
  const user = "sender@gmail.com";

  it("fixes the exact malformed case that broke delivery: no angle brackets", () => {
    expect(buildFromHeader(user, "Cashora sender@gmail.com")).toBe(`"Cashora" <${user}>`);
  });

  it("handles properly bracketed input unchanged in spirit", () => {
    expect(buildFromHeader(user, "Cashora <sender@gmail.com>")).toBe(`"Cashora" <${user}>`);
  });

  it("always uses the authenticated SMTP_USER as the address, even if SMTP_FROM names a different one", () => {
    expect(buildFromHeader(user, "Cashora <someone-else@example.com>")).toBe(`"Cashora" <${user}>`);
  });

  it("falls back to a bare address when no display name is present", () => {
    expect(buildFromHeader(user, "sender@gmail.com")).toBe(user);
  });

  it("strips stray quotes", () => {
    expect(buildFromHeader(user, '"Cashora" <sender@gmail.com>')).toBe(`"Cashora" <${user}>`);
  });

  it("handles a multi-word display name", () => {
    expect(buildFromHeader(user, "Cashora Notifications <sender@gmail.com>")).toBe(`"Cashora Notifications" <${user}>`);
  });
});
