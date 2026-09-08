import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getCurrentUser, requireUser } from "@/server/auth";
import { isGoogleSheetsConfigured } from "@/lib/env";
import { updateProfileSchema } from "@/validations/profile";
import { syncUserRow } from "@/services/sheets";
import { handleApiError } from "@/server/api-utils";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ user: null });
  return NextResponse.json({ user, features: { googleSheets: isGoogleSheetsConfigured } });
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await requireUser();
    const { name } = updateProfileSchema.parse(await req.json());

    const [updated] = await db.update(users).set({ name }).where(eq(users.id, user.id)).returning();

    void syncUserRow({
      id: updated.id,
      name: updated.name,
      email: updated.email,
      createdAt: updated.createdAt.toISOString(),
      lastActiveAt: updated.lastActiveAt.toISOString(),
    });

    return NextResponse.json({ user: { ...user, name: updated.name } });
  } catch (err) {
    return handleApiError(err);
  }
}
