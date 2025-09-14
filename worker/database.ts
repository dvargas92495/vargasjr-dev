import { drizzle } from "drizzle-orm/vercel-postgres";
import { sql } from "@vercel/postgres";
import * as dotenv from "dotenv";

dotenv.config();

/** @public */
export function createDatabaseConnection() {
  const postgresUrl = process.env.NEON_URL || process.env.POSTGRES_URL;

  if (!postgresUrl) {
    throw new Error("POSTGRES_URL environment variable is required");
  }

  return drizzle(sql);
}

/** @public */
export function getDb() {
  return createDatabaseConnection();
}

/** @public */
export function postgresSession() {
  return getDb();
}
