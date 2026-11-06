import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./drizzle/schema.ts",
  out: "./drizzle/migrations",
  dbCredentials: {
    // Neutral name first; LOVABLE_DB_MIGRATION_URL is the pre-migration fallback.
    url: process.env.DATABASE_MIGRATION_URL ?? process.env.LOVABLE_DB_MIGRATION_URL ?? "",
  },
});
