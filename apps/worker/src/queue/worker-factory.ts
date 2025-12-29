/**
 * Worker Factory
 *
 * Creates BullMQ workers with standardized error handling,
 * logging, and lifecycle management.
 */

import { Worker, Job, Processor, WorkerOptions } from "bullmq";
import { getRedisConnection } from "./connection.js";
import { QueueName } from "./queues.js";
import { config } from "../config.js";
import { logger, createJobLogger } from "../logger.js";
import { Result, isErr, DomainError } from "@sis/domain";

/**
 * Job processor that returns a Result
 */
export type ResultProcessor<TData, TResult> = (
  job: Job<TData>
) => Promise<Result<TResult, DomainError>>;

/**
 * Options for creating a worker
 */
export interface CreateWorkerOptions<TData, TResult> {
  /** Queue to process */
  queueName: QueueName;
  /** Job processor function */
  processor: ResultProcessor<TData, TResult>;
  /** Override default concurrency */
  concurrency?: number;
  /** Additional worker options */
  workerOptions?: Partial<WorkerOptions>;
}

/**
 * Managed worker with lifecycle hooks
 */
export interface ManagedWorker {
  worker: Worker;
  close: () => Promise<void>;
}

/**
 * Create a worker with standardized error handling
 */
export function createWorker<TData, TResult>(
  options: CreateWorkerOptions<TData, TResult>
): ManagedWorker {
  const { queueName, processor, concurrency, workerOptions } = options;

  const wrappedProcessor: Processor<TData, TResult> = async (job) => {
    const jobLogger = createJobLogger(queueName, job.id ?? "unknown");
    const startTime = Date.now();

    jobLogger.info({ data: job.data }, "Job started");

    try {
      const result = await processor(job);

      if (isErr(result)) {
        // Domain error - log and throw to trigger retry
        jobLogger.error(
          {
            error: result.error,
            duration: Date.now() - startTime,
          },
          "Job failed with domain error"
        );
        throw new Error(
          `${result.error.code}: ${result.error.message}`
        );
      }

      jobLogger.info(
        { duration: Date.now() - startTime },
        "Job completed successfully"
      );

      return result.value;
    } catch (error) {
      // Unexpected error
      jobLogger.error(
        {
          err: error,
          duration: Date.now() - startTime,
        },
        "Job failed with unexpected error"
      );
      throw error;
    }
  };

  const worker = new Worker<TData, TResult>(queueName, wrappedProcessor, {
    connection: getRedisConnection(),
    concurrency: concurrency ?? config.WORKER_CONCURRENCY,
    ...workerOptions,
  });

  // Worker event handlers
  worker.on("ready", () => {
    logger.info({ queue: queueName }, "Worker ready");
  });

  worker.on("active", (job) => {
    logger.debug({ queue: queueName, jobId: job.id }, "Job active");
  });

  worker.on("completed", (job) => {
    logger.debug({ queue: queueName, jobId: job.id }, "Job completed");
  });

  worker.on("failed", (job, error) => {
    logger.error(
      { queue: queueName, jobId: job?.id, err: error },
      "Job failed"
    );
  });

  worker.on("error", (error) => {
    logger.error({ queue: queueName, err: error }, "Worker error");
  });

  worker.on("stalled", (jobId) => {
    logger.warn({ queue: queueName, jobId }, "Job stalled");
  });

  return {
    worker,
    close: async () => {
      logger.info({ queue: queueName }, "Closing worker");
      await worker.close();
    },
  };
}

/**
 * Collection of managed workers
 */
export class WorkerRegistry {
  private workers: ManagedWorker[] = [];

  register(worker: ManagedWorker): void {
    this.workers.push(worker);
  }

  async closeAll(): Promise<void> {
    logger.info(
      { count: this.workers.length },
      "Closing all workers"
    );
    await Promise.all(this.workers.map((w) => w.close()));
    this.workers = [];
  }
}
