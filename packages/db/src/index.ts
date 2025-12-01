import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema/index.js";

// Re-export schema for consumers
export * from "./schema/index.js";
export { schema };

// Database connection
const connectionString = process.env["DATABASE_URL"];

if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is required");
}

// Create postgres client
// For serverless/edge, use { max: 1 }
// For long-running servers, use connection pooling
const client = postgres(connectionString, {
  max: process.env["NODE_ENV"] === "production" ? 20 : 5,
  idle_timeout: 20,
  connect_timeout: 10,
});

// Create Drizzle instance with schema
export const db = drizzle(client, { schema });

// Export types for use in application
export type Database = typeof db;

// Utility to get a transaction
export async function withTransaction<T>(
  fn: (tx: Parameters<Parameters<typeof db.transaction>[0]>[0]) => Promise<T>
): Promise<T> {
  return db.transaction(fn);
}

// Transaction type for external use
export type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

// Health check function
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    await client`SELECT 1`;
    return true;
  } catch (error) {
    console.error("Database health check failed:", error);
    return false;
  }
}

// Graceful shutdown
export async function closeDatabaseConnection(): Promise<void> {
  await client.end();
}
