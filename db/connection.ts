import { drizzle } from "drizzle-orm/vercel-postgres";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-serverless";
import { sql } from "@vercel/postgres";
import { neon } from "@neondatabase/serverless";

export function createDatabaseConnection() {
  const neonUrl = process.env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED;
  const vercelUrl = process.env.POSTGRES_URL;

  if (neonUrl) {
    return drizzleNeon(neonUrl);
  } else if (vercelUrl) {
    return drizzle(sql);
  } else {
    throw new Error("No database URL found. Please set DATABASE_URL or POSTGRES_URL environment variable.");
  }
}

export function getDb() {
  return createDatabaseConnection();
}

let _db: ReturnType<typeof createDatabaseConnection> | null = null;

export const db = new Proxy({} as ReturnType<typeof createDatabaseConnection>, {
  get(target, prop) {
    if (!_db) {
      _db = createDatabaseConnection();
    }
    return (_db as any)[prop];
  }
});
