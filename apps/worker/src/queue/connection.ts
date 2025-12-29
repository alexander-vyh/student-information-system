/**
 * Redis Connection
 *
 * Shared Redis connection for BullMQ queues and workers.
 * Uses ioredis with proper configuration for BullMQ.
 */

import { Redis } from "ioredis";
type RedisClient = Redis;
import { config } from "../config.js";
import { logger } from "../logger.js";

/**
 * Create Redis connection with BullMQ-compatible settings
 */
export function createRedisConnection(): RedisClient {
  const connection = new Redis(config.REDIS_URL, {
    maxRetriesPerRequest: null, // Required by BullMQ
    enableReadyCheck: false,
    retryStrategy: (times: number) => {
      if (times > 10) {
        logger.error({ times }, "Redis connection failed after max retries");
        return null; // Stop retrying
      }
      const delay = Math.min(times * 200, 5000);
      logger.warn({ times, delay }, "Retrying Redis connection");
      return delay;
    },
  });

  connection.on("connect", () => {
    logger.info("Redis connected");
  });

  connection.on("error", (err: Error) => {
    logger.error({ err }, "Redis connection error");
  });

  connection.on("close", () => {
    logger.warn("Redis connection closed");
  });

  return connection;
}

// Singleton connection for the worker process
let sharedConnection: RedisClient | null = null;

export function getRedisConnection(): RedisClient {
  if (!sharedConnection) {
    sharedConnection = createRedisConnection();
  }
  return sharedConnection;
}

export async function closeRedisConnection(): Promise<void> {
  if (sharedConnection) {
    await sharedConnection.quit();
    sharedConnection = null;
    logger.info("Redis connection closed gracefully");
  }
}
