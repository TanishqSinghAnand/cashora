import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const SESSION_COOKIE = "cashora_session";
const PROTECTED_PREFIXES = ["/dashboard", "/cashbooks", "/activity", "/profile"];
// /invite/[token] is intentionally public: it shows which email the invite
// was sent to *before* asking someone to sign in, so they pick the right
// account. Accepting still requires auth and an email match (see
// /api/invitations/[token]/accept).

// This is a fast, edge-only UX check (redirect logged-out visitors before the
// page even renders). It intentionally does NOT hit the database — the real
// authorization + revocation check happens server-side in requireUser() on
// every API route and page, which is what actually protects the data.
async function hasValidLookingSession(req: NextRequest): Promise<boolean> {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return false;
  try {
    const secret = new TextEncoder().encode(process.env.AUTH_SECRET ?? "dev-insecure-secret-do-not-use-in-production");
    await jwtVerify(token, secret);
    return true;
  } catch {
    return false;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isProtected = PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  if (!isProtected) return NextResponse.next();

  const ok = await hasValidLookingSession(req);
  if (!ok) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/cashbooks/:path*", "/activity/:path*", "/profile/:path*"],
};
