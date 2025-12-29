/**
 * Worker Entry Point
 *
 * Initializes and manages all background job workers.
 * Handles graceful shutdown on SIGTERM/SIGINT.
 */

import { logger } from "./logger.js";
import { config } from "./config.js";
import {
  closeRedisConnection,
  closeAllQueues,
  createWorker,
  WorkerRegistry,
  QUEUE_NAMES,
} from "./queue/index.js";
import { processSapBatchJob, processGpaBatchJob } from "./jobs/index.js";

const registry = new WorkerRegistry();

/**
 * Initialize all workers
 */
function initializeWorkers(): void {
  logger.info("Initializing workers...");

  // SAP Calculation Worker
  registry.register(
    createWorker({
      queueName: QUEUE_NAMES.SAP_CALCULATION,
      processor: processSapBatchJob,
      concurrency: 2, // SAP is heavier, lower concurrency
    })
  );

  // GPA Calculation Worker
  registry.register(
    createWorker({
      queueName: QUEUE_NAMES.GPA_CALCULATION,
      processor: processGpaBatchJob,
      concurrency: 5, // GPA is lighter, higher concurrency
    })
  );

  logger.info("All workers initialized");
}

/**
 * Graceful shutdown handler
 */
async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, "Shutdown signal received");

  try {
    // Close workers first (let them finish current jobs)
    await registry.closeAll();

    // Close queues
    await closeAllQueues();

    // Close Redis connection
    await closeRedisConnection();

    logger.info("Graceful shutdown completed");
    process.exit(0);
  } catch (error) {
    logger.error({ err: error }, "Error during shutdown");
    process.exit(1);
  }
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  logger.info(
    {
      nodeEnv: config.NODE_ENV,
      concurrency: config.WORKER_CONCURRENCY,
    },
    "Starting SIS Worker"
  );

  // Register shutdown handlers
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  // Handle uncaught errors
  process.on("uncaughtException", (error) => {
    logger.fatal({ err: error }, "Uncaught exception");
    shutdown("uncaughtException");
  });

  process.on("unhandledRejection", (reason) => {
    logger.fatal({ reason }, "Unhandled rejection");
    shutdown("unhandledRejection");
  });

  // Initialize workers
  initializeWorkers();

  logger.info("Worker is ready and processing jobs");
}

// Start the worker
main().catch((error) => {
  logger.fatal({ err: error }, "Failed to start worker");
  process.exit(1);
});
