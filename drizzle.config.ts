import type { Config } from "drizzle-kit";

const databaseUrl = process.env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED || process.env.POSTGRES_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL, DATABASE_URL_UNPOOLED, or POSTGRES_URL environment variable is required");
}

export default {
  schema: "./db/schema.ts",
  out: "./db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl,
  },
} satisfies Config;
