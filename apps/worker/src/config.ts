/**
 * Worker Configuration
 *
 * Environment-based configuration with validation.
 * Fail-fast on missing required values.
 */

import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),

  // Redis connection
  REDIS_URL: z.string().default("redis://localhost:6379"),

  // Worker settings
  WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(50).default(5),

  // Job settings
  JOB_ATTEMPTS: z.coerce.number().int().min(1).max(10).default(3),
  JOB_BACKOFF_MS: z.coerce.number().int().min(1000).default(5000),

  // Batch sizes
  BATCH_SIZE_DEFAULT: z.coerce.number().int().min(10).max(1000).default(100),
  BATCH_SIZE_SAP: z.coerce.number().int().min(10).max(500).default(50),
  BATCH_SIZE_GPA: z.coerce.number().int().min(10).max(500).default(100),
});

function loadConfig() {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error("❌ Invalid environment configuration:");
    console.error(result.error.format());
    process.exit(1);
  }

  return result.data;
}

export const config = loadConfig();

export type Config = typeof config;
