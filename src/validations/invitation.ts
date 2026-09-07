import { z } from "zod";

export const createInvitationSchema = z.object({
  email: z.string().trim().email("Enter a valid email"),
  permission: z.enum(["VIEW", "EDIT"]).default("EDIT"),
});

export type CreateInvitationInput = z.infer<typeof createInvitationSchema>;
