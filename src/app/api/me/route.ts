import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth";
import { isGoogleSheetsConfigured, isTelegramConfigured } from "@/lib/env";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ user: null }, { status: 401 });
  return NextResponse.json({ user, features: { telegram: isTelegramConfigured, googleSheets: isGoogleSheetsConfigured } });
}
