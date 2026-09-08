import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth";
import { isGoogleSheetsConfigured } from "@/lib/env";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ user: null });
  return NextResponse.json({ user, features: { googleSheets: isGoogleSheetsConfigured } });
}
