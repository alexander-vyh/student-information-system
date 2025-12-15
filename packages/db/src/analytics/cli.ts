#!/usr/bin/env tsx
/**
 * DuckDB Analytics CLI
 *
 * Interactive REPL for running analytics queries against PostgreSQL.
 *
 * Usage:
 *   pnpm db:analytics              # Interactive mode
 *   pnpm db:analytics <query>      # Run named query from queries/
 *
 * Commands in REPL:
 *   .help     - Show help
 *   .tables   - List all tables (from all schemas)
 *   .schemas  - List all schemas
 *   .queries  - List available named queries
 *   .run <n>  - Run a named query
 *   .quit     - Exit
 *
 * Any other input is treated as SQL and executed directly.
 */

import * as readline from "readline";
import { createAnalyticsDb, listQueries, loadQuery, type AnalyticsDb } from "./index.js";
import "dotenv/config";

const COLORS = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  magenta: "\x1b[35m",
};

function log(msg: string, color: keyof typeof COLORS = "reset") {
  console.log(`${COLORS[color]}${msg}${COLORS.reset}`);
}

function formatTable(rows: Record<string, unknown>[]): void {
  if (rows.length === 0) {
    log("(no results)", "dim");
    return;
  }

  const firstRow = rows[0];
  if (!firstRow) {
    log("(no results)", "dim");
    return;
  }

  const columns = Object.keys(firstRow);
  const widths = columns.map((col) => {
    const maxVal = Math.max(
      col.length,
      ...rows.map((r) => String(r[col] ?? "").length)
    );
    return Math.min(maxVal, 40); // Cap at 40 chars
  });

  // Header
  const header = columns
    .map((col, i) => col.padEnd(widths[i] ?? 10))
    .join(" | ");
  const separator = widths.map((w) => "-".repeat(w)).join("-+-");

  log(header, "bright");
  console.log(separator);

  // Rows
  for (const row of rows) {
    const line = columns
      .map((col, i) => {
        const val = String(row[col] ?? "");
        const width = widths[i] ?? 10;
        return val.length > width
          ? val.slice(0, width - 1) + "~"
          : val.padEnd(width);
      })
      .join(" | ");
    console.log(line);
  }

  log(`\n${rows.length} row(s)`, "dim");
}

async function showHelp() {
  console.log(`
${COLORS.cyan}DuckDB Analytics CLI${COLORS.reset}
Queries PostgreSQL via DuckDB's postgres_scanner (read-only).

${COLORS.bright}Commands:${COLORS.reset}
  .help           Show this help
  .tables         List all tables
  .schemas        List all schemas
  .queries        List available named queries
  .run <name>     Run a named query from queries/
  .quit           Exit

${COLORS.bright}Examples:${COLORS.reset}
  SELECT * FROM pg.student.students LIMIT 10;
  SELECT COUNT(*) FROM pg.enrollment.registrations;
  .run enrollment-summary
`);
}

async function runRepl(analytics: AnalyticsDb) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: `${COLORS.green}duckdb>${COLORS.reset} `,
  });

  log("\nDuckDB Analytics CLI - Type .help for commands\n", "cyan");
  rl.prompt();

  let multilineBuffer = "";

  rl.on("line", async (line) => {
    const input = (multilineBuffer + line).trim();

    // Handle multi-line SQL (if line doesn't end with ;)
    if (input && !input.startsWith(".") && !input.endsWith(";")) {
      multilineBuffer = input + " ";
      process.stdout.write(`${COLORS.dim}...>${COLORS.reset} `);
      return;
    }
    multilineBuffer = "";

    if (!input) {
      rl.prompt();
      return;
    }

    try {
      if (input === ".quit" || input === ".exit" || input === ".q") {
        log("Goodbye!", "cyan");
        analytics.close();
        process.exit(0);
      }

      if (input === ".help" || input === ".h") {
        await showHelp();
      } else if (input === ".tables") {
        const tables = await analytics.query(`
          SELECT table_schema, table_name
          FROM pg.information_schema.tables
          WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
          ORDER BY table_schema, table_name
        `);
        formatTable(tables);
      } else if (input === ".schemas") {
        const schemas = await analytics.query(`
          SELECT schema_name
          FROM pg.information_schema.schemata
          WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
          ORDER BY schema_name
        `);
        formatTable(schemas);
      } else if (input === ".queries") {
        const queries = listQueries();
        if (queries.length === 0) {
          log("No queries found in queries/ directory", "yellow");
        } else {
          log("\nAvailable queries:", "bright");
          for (const q of queries) {
            log(`  ${q}`, "cyan");
          }
          console.log();
        }
      } else if (input.startsWith(".run ")) {
        const queryName = input.slice(5).trim();
        try {
          const sql = loadQuery(queryName);
          log(`\n-- Running: ${queryName}.sql --`, "dim");
          const start = Date.now();
          const results = await analytics.query(sql);
          const elapsed = Date.now() - start;
          formatTable(results);
          log(`Query time: ${elapsed}ms`, "dim");
        } catch (err) {
          log(`Query not found: ${queryName}`, "red");
        }
      } else if (input.startsWith(".")) {
        log(`Unknown command: ${input}`, "red");
      } else {
        // Execute SQL
        const start = Date.now();
        const results = await analytics.query(input);
        const elapsed = Date.now() - start;
        formatTable(results);
        log(`Query time: ${elapsed}ms`, "dim");
      }
    } catch (err) {
      log(`Error: ${(err as Error).message}`, "red");
    }

    console.log();
    rl.prompt();
  });

  rl.on("close", () => {
    log("\nGoodbye!", "cyan");
    analytics.close();
    process.exit(0);
  });
}

async function main() {
  const args = process.argv.slice(2);

  // Check for DATABASE_URL
  if (!process.env["DATABASE_URL"]) {
    log("Error: DATABASE_URL environment variable not set", "red");
    process.exit(1);
  }

  log("Connecting to PostgreSQL via DuckDB...", "dim");

  try {
    const analytics = await createAnalyticsDb();
    log("Connected!\n", "green");

    if (args.length > 0 && args[0]) {
      // Non-interactive: run named query
      const queryName = args[0];
      try {
        const sql = loadQuery(queryName);
        log(`Running: ${queryName}.sql\n`, "cyan");
        const results = await analytics.query(sql);
        formatTable(results);
        analytics.close();
      } catch (err) {
        log(`Error loading query "${queryName}": ${(err as Error).message}`, "red");
        log(`Available queries: ${listQueries().join(", ") || "(none)"}`, "dim");
        analytics.close();
        process.exit(1);
      }
    } else {
      // Interactive REPL
      await runRepl(analytics);
    }
  } catch (err) {
    log(`Failed to connect: ${(err as Error).message}`, "red");
    process.exit(1);
  }
}

main();
