import { NextResponse } from "next/server";
import { env, isGoogleSheetsConfigured, isTelegramConfigured } from "@/lib/env";

export async function GET() {
  return NextResponse.json({
    telegram: isTelegramConfigured,
    telegramBotUsername: env.telegramBotUsername ?? null,
    googleSheets: isGoogleSheetsConfigured,
    demoAuth: env.demoAuthEnabled,
  });
}
