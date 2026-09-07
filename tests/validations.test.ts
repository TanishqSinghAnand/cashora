import { describe, it, expect } from "vitest";
import { createTransactionSchema } from "@/validations/transaction";
import { createCashbookSchema } from "@/validations/cashbook";
import { createInvitationSchema } from "@/validations/invitation";

describe("createTransactionSchema", () => {
  it("accepts a valid cash-in payload", () => {
    const result = createTransactionSchema.safeParse({ type: "CASH_IN", amount: 5000, person: "Rahul" });
    expect(result.success).toBe(true);
  });

  it("rejects zero or negative amounts", () => {
    expect(createTransactionSchema.safeParse({ type: "CASH_IN", amount: 0 }).success).toBe(false);
    expect(createTransactionSchema.safeParse({ type: "CASH_IN", amount: -100 }).success).toBe(false);
  });

  it("rejects an invalid type", () => {
    const result = createTransactionSchema.safeParse({ type: "INVALID", amount: 100 });
    expect(result.success).toBe(false);
  });
});

describe("createCashbookSchema", () => {
  it("defaults currency and initial balance", () => {
    const result = createCashbookSchema.parse({ name: "Shop" });
    expect(result.currency).toBe("INR");
    expect(result.initialBalance).toBe(0);
  });

  it("rejects an empty name", () => {
    expect(createCashbookSchema.safeParse({ name: "" }).success).toBe(false);
  });

  it("rejects an invalid collaborator email", () => {
    expect(createCashbookSchema.safeParse({ name: "Shop", collaboratorEmail: "not-an-email" }).success).toBe(false);
  });
});

describe("createInvitationSchema", () => {
  it("requires a valid email", () => {
    expect(createInvitationSchema.safeParse({ email: "rahul@example.com" }).success).toBe(true);
    expect(createInvitationSchema.safeParse({ email: "nope" }).success).toBe(false);
  });

  it("defaults permission to EDIT", () => {
    const result = createInvitationSchema.parse({ email: "rahul@example.com" });
    expect(result.permission).toBe("EDIT");
  });
});
