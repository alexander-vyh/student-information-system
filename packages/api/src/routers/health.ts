/**
 * Health Router
 *
 * Endpoints for health checks and system status.
 */

import { router, publicProcedure } from "../trpc.js";
import { sql } from "drizzle-orm";

export const healthRouter = router({
  /**
   * Basic health check
   */
  check: publicProcedure.query(() => {
    return {
      status: "healthy",
      timestamp: new Date().toISOString(),
    };
  }),

  /**
   * Detailed health check with database connectivity
   */
  detailed: publicProcedure.query(async ({ ctx }) => {
    const checks = {
      api: { status: "healthy" as const },
      database: { status: "unknown" as "healthy" | "unhealthy" | "unknown" },
    };

    // Check database
    try {
      await ctx.db.execute(sql`SELECT 1`);
      checks.database.status = "healthy";
    } catch {
      checks.database.status = "unhealthy";
    }

    const allHealthy = Object.values(checks).every(
      (check) => check.status === "healthy"
    );

    return {
      status: allHealthy ? "healthy" : "degraded",
      timestamp: new Date().toISOString(),
      checks,
    };
  }),
});
