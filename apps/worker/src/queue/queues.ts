/**
 * Queue Definitions
 *
 * Centralized queue configuration for all background jobs.
 * Each queue has specific settings tuned for its workload.
 */

import { Queue, QueueOptions } from "bullmq";
import { getRedisConnection } from "./connection.js";
import { config } from "../config.js";

/**
 * Queue names as const for type safety
 */
export const QUEUE_NAMES = {
  SAP_CALCULATION: "sap-calculation",
  GPA_CALCULATION: "gpa-calculation",
  NOTIFICATIONS: "notifications",
  REPORTS: "reports",
  AUDIT_LOG: "audit-log",
  WAITLIST_PROCESSING: "waitlist-processing",
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

/**
 * Default queue options
 */
const defaultQueueOptions: Partial<QueueOptions> = {
  defaultJobOptions: {
    attempts: config.JOB_ATTEMPTS,
    backoff: {
      type: "exponential",
      delay: config.JOB_BACKOFF_MS,
    },
    removeOnComplete: {
      age: 24 * 60 * 60, // Keep completed jobs for 24 hours
      count: 1000, // Keep last 1000 completed jobs
    },
    removeOnFail: {
      age: 7 * 24 * 60 * 60, // Keep failed jobs for 7 days
    },
  },
};

/**
 * Queue instances (lazy initialization)
 */
const queues = new Map<QueueName, Queue>();

export function getQueue(name: QueueName): Queue {
  let queue = queues.get(name);
  if (!queue) {
    queue = new Queue(name, {
      connection: getRedisConnection(),
      ...defaultQueueOptions,
    });
    queues.set(name, queue);
  }
  return queue;
}

/**
 * Close all queues gracefully
 */
export async function closeAllQueues(): Promise<void> {
  const closePromises = Array.from(queues.values()).map((q) => q.close());
  await Promise.all(closePromises);
  queues.clear();
}
