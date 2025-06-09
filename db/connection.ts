import { drizzle } from "drizzle-orm/vercel-postgres";
import { sql } from "@vercel/postgres";

export function createDatabaseConnection() {
  const vercelUrl = process.env.POSTGRES_URL;

  if (!vercelUrl) {
    throw new Error("POSTGRES_URL environment variable is required");
  }

  return drizzle(sql);
}

export function getDb() {
  return createDatabaseConnection();
}
