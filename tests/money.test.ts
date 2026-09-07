import { describe, it, expect } from "vitest";
import { toMinorUnits, fromMinorUnits, formatMoney } from "@/lib/money";

describe("money", () => {
  it("converts to minor units without floating point drift", () => {
    expect(toMinorUnits(50000)).toBe(5_000_000);
    expect(toMinorUnits(10.1)).toBe(1010);
    expect(toMinorUnits("2500.50")).toBe(250050);
    expect(toMinorUnits(0.1 + 0.2)).toBe(30); // 0.30000000000000004 -> 30 paise, not 29
  });

  it("converts back from minor units", () => {
    expect(fromMinorUnits(5_000_000)).toBe(50000);
    expect(fromMinorUnits(1010)).toBe(10.1);
  });

  it("formats money with currency symbol and sign", () => {
    expect(formatMoney(6_300_000, "INR")).toBe("₹63,000.00");
    expect(formatMoney(-250000, "INR")).toBe("-₹2,500.00");
    expect(formatMoney(100, "USD")).toBe("$1.00");
  });

  it("rejects invalid amounts", () => {
    expect(() => toMinorUnits(Number.NaN)).toThrow();
  });
});
