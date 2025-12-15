/**
 * Next.js Middleware
 *
 * Handles authentication, rate limiting, and route protection at the edge.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth/config";
import { rateLimiters, getClientIp } from "@/lib/rate-limit";

// Create NextAuth middleware handler
const { auth } = NextAuth(authConfig);

/**
 * Rate limit response with appropriate headers
 */
function rateLimitResponse(result: ReturnType<typeof rateLimiters.auth>) {
  return new NextResponse(
    JSON.stringify({
      error: "Too many requests",
      message: "Please try again later",
      retryAfter: Math.ceil((result.reset - Date.now()) / 1000),
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(Math.ceil((result.reset - Date.now()) / 1000)),
        "X-RateLimit-Limit": String(result.limit),
        "X-RateLimit-Remaining": String(result.remaining),
        "X-RateLimit-Reset": String(result.reset),
      },
    }
  );
}

/**
 * Main middleware function
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const clientIp = getClientIp(request);

  // Rate limit authentication endpoints (login, register, password reset)
  if (
    pathname === "/api/auth/callback/credentials" ||
    pathname === "/api/auth/signin" ||
    pathname.startsWith("/api/auth/")
  ) {
    const result = rateLimiters.auth(clientIp);
    if (!result.success) {
      return rateLimitResponse(result);
    }
  }

  // Rate limit API endpoints (tRPC and other APIs)
  if (pathname.startsWith("/api/") && !pathname.startsWith("/api/auth/")) {
    const result = rateLimiters.api(clientIp);
    if (!result.success) {
      return rateLimitResponse(result);
    }
  }

  // Run NextAuth middleware for authentication
  // @ts-expect-error - NextAuth middleware types are complex
  return auth(request);
}

export const config = {
  // Match all routes except static files, images, and public paths
  matcher: ["/((?!_next/static|_next/image|favicon.ico|public/).*)"],
};
