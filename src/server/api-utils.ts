import "server-only";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { ForbiddenError, NotFoundError } from "./permissions";

export function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

/**
 * Maps known domain errors to HTTP status codes and hides everything else
 * behind a generic 500 message so internal details never leak to clients.
 */
export function handleApiError(err: unknown): NextResponse {
  if (err instanceof ZodError) {
    return jsonError(err.issues[0]?.message ?? "Invalid input", 400);
  }
  if (err instanceof NotFoundError) {
    return jsonError(err.message, 404);
  }
  if (err instanceof ForbiddenError) {
    return jsonError(err.message, 403);
  }
  if (err instanceof Error && err.name === "UnauthorizedError") {
    return jsonError("Unauthorized", 401);
  }

  console.error("[api] unhandled error", err);
  return jsonError("Something went wrong. Please try again.", 500);
}
