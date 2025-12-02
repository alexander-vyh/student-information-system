import { defineConfig } from "drizzle-kit";
import "dotenv/config";

export default defineConfig({
  dialect: "postgresql",
  schema: "./dist/schema/index.js",
  out: "./migrations",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  schemaFilter: ["core", "identity", "student", "curriculum", "enrollment", "financial", "aid", "scheduling", "system"],
  verbose: true,
  strict: true,
});
