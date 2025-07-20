import type { Config } from "drizzle-kit";

const databaseUrl = process.env.POSTGRES_URL;

const config: Config = !databaseUrl ? {
  schema: "./db/sqlite-schema.ts",
  out: "./db/migrations",
  dialect: "sqlite",
  dbCredentials: {
    url: "./local.db",
  },
} : {
  schema: "./db/schema.ts",
  out: "./db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl,
  },
};

export default config;
