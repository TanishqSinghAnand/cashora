import { z } from "zod";

export const requestOtpSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
});

export const verifyOtpSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  code: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code"),
});
