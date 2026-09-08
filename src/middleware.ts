import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isProtectedRoute = createRouteMatcher([
  "/dashboard(.*)",
  "/cashbooks(.*)",
  "/activity(.*)",
  "/profile(.*)",
]);
// /invite/[token] is intentionally public: it shows which email the invite
// was sent to *before* asking someone to sign in, so they pick the right
// account. Accepting still requires auth and an email match (see
// /api/invitations/[token]/accept).

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: ["/((?!_next|.*\\..*).*)", "/(api|trpc)(.*)"],
};
