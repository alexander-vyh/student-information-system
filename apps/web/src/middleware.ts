/**
 * Next.js Middleware
 *
 * Handles authentication and route protection at the edge.
 */

import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth/config";

export const { auth: middleware } = NextAuth(authConfig);

export const config = {
  // Match all routes except static files, images, and public paths
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|public/).*)",
  ],
};
