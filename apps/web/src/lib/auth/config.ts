/**
 * NextAuth.js v5 Configuration
 *
 * Handles authentication for the Student Information System.
 * Supports multiple providers for different deployment scenarios.
 */

import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import { db } from "@sis/db";
import { eq } from "drizzle-orm";
import { users, sessions, students } from "@sis/db/schema";
import { verifyPassword, needsRehash, hashPassword } from "./password";

/**
 * Credential validation schema
 */
const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

/**
 * Extended session user type
 */
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      roles: string[];
      institutionId: string;
      studentId?: string;
    };
  }

  interface User {
    roles: string[];
    institutionId: string;
    studentId?: string;
  }
}


/**
 * NextAuth configuration
 */
export const authConfig: NextAuthConfig = {
  pages: {
    signIn: "/login",
    signOut: "/logout",
    error: "/auth/error",
    newUser: "/welcome",
  },

  callbacks: {
    /**
     * Control access to routes
     */
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isOnDashboard = nextUrl.pathname.startsWith("/dashboard");
      const isOnAdmin = nextUrl.pathname.startsWith("/admin");
      const isOnApi = nextUrl.pathname.startsWith("/api");

      // API routes are handled by tRPC middleware
      if (isOnApi) {
        return true;
      }

      // Dashboard requires authentication
      if (isOnDashboard || isOnAdmin) {
        if (isLoggedIn) return true;
        return false; // Redirect to login
      }

      // Redirect logged-in users from login page to dashboard
      if (isLoggedIn && nextUrl.pathname === "/login") {
        return Response.redirect(new URL("/dashboard", nextUrl));
      }

      return true;
    },

    /**
     * Populate JWT with user data
     */
    async jwt({ token, user, trigger, session }) {
      if (user) {
        // Initial sign in
        token["id"] = user.id;
        token["roles"] = user.roles;
        token["institutionId"] = user.institutionId;
        token["studentId"] = user.studentId;
      }

      // Handle session updates
      if (trigger === "update" && session) {
        token["roles"] = (session as { roles?: string[] }).roles ?? token["roles"];
      }

      return token;
    },

    /**
     * Populate session with user data
     */
    async session({ session, token }) {
      if (token) {
        session.user.id = token["id"] as string;
        session.user.roles = token["roles"] as string[];
        session.user.institutionId = token["institutionId"] as string;
        session.user.studentId = token["studentId"] as string | undefined;
      }
      return session;
    },
  },

  providers: [
    /**
     * Credentials provider for email/password authentication
     *
     * Uses bcrypt for password hashing (see ./password.ts).
     * Rate limiting is handled by middleware.
     */
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        // Validate input
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) {
          return null;
        }

        const { email, password } = parsed.data;

        // Find user by email
        const user = await db.query.users.findFirst({
          where: eq(users.email, email.toLowerCase()),
          with: {
            userRoles: {
              with: {
                role: true,
              },
            },
          },
        });

        if (!user) {
          return null;
        }

        // Check if user is active
        if (user.status !== "active") {
          return null;
        }

        // Verify password using bcrypt
        const validPassword = await verifyPassword(password, user.passwordHash);

        if (!validPassword) {
          return null;
        }

        // Check if password hash needs to be upgraded (cost factor increased)
        if (user.passwordHash && needsRehash(user.passwordHash)) {
          const newHash = await hashPassword(password);
          await db
            .update(users)
            .set({ passwordHash: newHash })
            .where(eq(users.id, user.id));
        }

        // Update last login
        await db
          .update(users)
          .set({
            lastLoginAt: new Date(),
          })
          .where(eq(users.id, user.id));

        // Get roles
        const roles = user.userRoles.map((ur) => ur.role.code);

        // Get studentId if user has student role
        let studentId: string | undefined;
        if (roles.includes("STUDENT")) {
          const studentRecord = await db.query.students.findFirst({
            where: eq(students.userId, user.id),
            columns: { id: true },
          });
          studentId = studentRecord?.id;
        }

        return {
          id: user.id,
          email: user.email,
          name: `${user.firstName} ${user.lastName}`,
          roles,
          institutionId: user.institutionId,
          studentId,
        };
      },
    }),

    // TODO: Add OAuth providers as needed
    // Google({
    //   clientId: process.env.GOOGLE_CLIENT_ID,
    //   clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    // }),
    // AzureAD({
    //   clientId: process.env.AZURE_AD_CLIENT_ID,
    //   clientSecret: process.env.AZURE_AD_CLIENT_SECRET,
    //   tenantId: process.env.AZURE_AD_TENANT_ID,
    // }),
  ],

  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60, // 8 hours
    updateAge: 60 * 60, // Refresh token every hour
  },

  // Secret for JWT signing
  secret: process.env["AUTH_SECRET"],

  // Enable debug in development
  debug: process.env["NODE_ENV"] === "development",
};

