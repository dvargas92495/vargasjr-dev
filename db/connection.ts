import { drizzle } from "drizzle-orm/vercel-postgres";
import { drizzle as drizzleNode } from "drizzle-orm/node-postgres";
import { sql } from "@vercel/postgres";
import { Pool } from "pg";

export function createDatabaseConnection() {
  const postgresUrl = process.env.NEON_URL || process.env.POSTGRES_URL;

  if (!postgresUrl) {
    throw new Error("POSTGRES_URL environment variable is required");
  }

  if (postgresUrl.includes("localhost")) {
    const pool = new Pool({
      connectionString: postgresUrl,
    });
    return drizzleNode(pool);
  } else {
    return drizzle(sql);
  }
}

export function getDb() {
  return createDatabaseConnection();
}
