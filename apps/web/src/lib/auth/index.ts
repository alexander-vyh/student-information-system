/**
 * Auth module exports
 *
 * Provides NextAuth handlers and utilities
 */

import NextAuth from "next-auth";
import { authConfig } from "./config";

export const {
  handlers: { GET, POST },
  auth,
  signIn,
  signOut,
} = NextAuth(authConfig);

/**
 * Get the current session (for use in server components)
 */
export { auth as getServerSession };

/**
 * Re-export config for middleware
 */
export { authConfig };
