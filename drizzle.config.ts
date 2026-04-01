import { defineConfig } from "drizzle-kit";

// DATABASE_URL (Replit) è ora il DB primario
const dbUrl = process.env.DATABASE_URL || process.env.EXTERNAL_DATABASE_URL;

if (!dbUrl) {
  throw new Error("DATABASE_URL or EXTERNAL_DATABASE_URL, ensure the database is provisioned");
}

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: dbUrl,
  },
});
