import type { Config } from "drizzle-kit";

const databaseUrl = process.env.POSTGRES_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set");
}

export default {
  schema: "./db/schema.ts",
  out: "./db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl,
  },
} satisfies Config;
