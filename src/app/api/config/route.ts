import { NextResponse } from "next/server";
import { isSmtpConfigured } from "@/lib/env";

export async function GET() {
  return NextResponse.json({ emailAuth: isSmtpConfigured });
}
