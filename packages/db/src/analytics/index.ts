/**
 * DuckDB Analytics Module
 *
 * Provides read-only analytics access to PostgreSQL via DuckDB's postgres_scanner.
 * Used for:
 * - Developer debugging and ad-hoc queries
 * - Scheduled batch reports (IPEDS, census)
 * - Complex aggregations without impacting OLTP
 */

import duckdb from "duckdb";
import { readFileSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface AnalyticsDb {
  db: duckdb.Database;
  conn: duckdb.Connection;
  query: <T = Record<string, unknown>>(sql: string) => Promise<T[]>;
  close: () => void;
}

/**
 * Creates a DuckDB connection with PostgreSQL attached via postgres_scanner.
 * All queries run against PostgreSQL in READ_ONLY mode.
 */
export function createAnalyticsDb(
  pgUrl: string = process.env["DATABASE_URL"]!
): Promise<AnalyticsDb> {
  return new Promise((resolve, reject) => {
    const db = new duckdb.Database(":memory:");
    const conn = db.connect();

    // Install and load postgres extension
    conn.exec("INSTALL postgres; LOAD postgres;", (err) => {
      if (err) {
        reject(new Error(`Failed to load postgres extension: ${err.message}`));
        return;
      }

      // Attach PostgreSQL in read-only mode
      const attachSql = `ATTACH '${pgUrl}' AS pg (TYPE postgres, READ_ONLY);`;
      conn.exec(attachSql, (attachErr) => {
        if (attachErr) {
          reject(
            new Error(`Failed to attach PostgreSQL: ${attachErr.message}`)
          );
          return;
        }

        // Helper to run queries with promise interface
        const query = <T = Record<string, unknown>>(sql: string): Promise<T[]> => {
          return new Promise((res, rej) => {
            conn.all(sql, (queryErr, result) => {
              if (queryErr) {
                rej(queryErr);
              } else {
                res(result as T[]);
              }
            });
          });
        };

        const close = () => {
          conn.close();
          db.close();
        };

        resolve({ db, conn, query, close });
      });
    });
  });
}

/**
 * Load a SQL query from the queries directory.
 */
export function loadQuery(name: string): string {
  const queryPath = join(__dirname, "queries", `${name}.sql`);
  return readFileSync(queryPath, "utf-8");
}

/**
 * List all available query files.
 */
export function listQueries(): string[] {
  const queriesDir = join(__dirname, "queries");
  try {
    return readdirSync(queriesDir)
      .filter((f) => f.endsWith(".sql"))
      .map((f) => f.replace(".sql", ""));
  } catch {
    return [];
  }
}

/**
 * Run a named query from the queries directory.
 */
export async function runNamedQuery<T = Record<string, unknown>>(
  name: string,
  params?: Record<string, unknown>
): Promise<T[]> {
  let sql = loadQuery(name);

  // Simple parameter substitution (e.g., :termId -> value)
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      const placeholder = `:${key}`;
      const replacement =
        typeof value === "string" ? `'${value}'` : String(value);
      sql = sql.replaceAll(placeholder, replacement);
    }
  }

  const analytics = await createAnalyticsDb();
  try {
    return await analytics.query<T>(sql);
  } finally {
    analytics.close();
  }
}
