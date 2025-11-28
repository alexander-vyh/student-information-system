/**
 * Structured Logger
 *
 * Pino-based logging for worker processes.
 * JSON format in production, pretty-print in development.
 */

import pino from "pino";
import { config } from "./config.js";

export const logger = pino({
  level: config.NODE_ENV === "production" ? "info" : "debug",
  transport:
    config.NODE_ENV === "development"
      ? {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "HH:MM:ss",
            ignore: "pid,hostname",
          },
        }
      : undefined,
  base: {
    service: "sis-worker",
    env: config.NODE_ENV,
  },
});

/**
 * Create a child logger with additional context
 */
export function createJobLogger(jobName: string, jobId: string) {
  return logger.child({ job: jobName, jobId });
}
