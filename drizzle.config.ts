import type { Config } from "drizzle-kit";

const databaseUrl = process.env.POSTGRES_URL;

if (!databaseUrl) {
  throw new Error("POSTGRES_URL environment variable is required");
}

const config: Config = {
  schema: "./db/schema.ts",
  out: "./db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl,
  },
};

export default config;
