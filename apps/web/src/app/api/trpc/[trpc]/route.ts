/**
 * tRPC API Route Handler
 *
 * Handles all tRPC requests via Next.js App Router.
 * Integrates with NextAuth for authentication context.
 */

import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter, createContext } from "@sis/api";
import { db } from "@sis/db";
import { auth } from "@/lib/auth";

const handler = async (req: Request) => {
  // Get session from NextAuth
  const session = await auth();

  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: () =>
      createContext({
        db,
        user: session?.user
          ? {
              id: session.user.id,
              email: session.user.email ?? "",
              roles: session.user.roles ?? [],
              institutionId: session.user.institutionId,
              studentId: session.user.studentId,
            }
          : null,
        session: session
          ? {
              id: session.user?.id ?? "",
              expiresAt: new Date(session.expires),
            }
          : null,
        req: {
          ip: req.headers.get("x-forwarded-for") ?? undefined,
          userAgent: req.headers.get("user-agent") ?? undefined,
        },
      }),
    onError:
      process.env.NODE_ENV === "development"
        ? ({ path, error }) => {
            console.error(
              `❌ tRPC failed on ${path ?? "<no-path>"}: ${error.message}`
            );
          }
        : undefined,
  });
};

export { handler as GET, handler as POST };
