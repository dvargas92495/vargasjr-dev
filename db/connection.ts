import { drizzle } from "drizzle-orm/vercel-postgres";
import { drizzle as drizzleNode } from "drizzle-orm/node-postgres";
import { sql } from "@vercel/postgres";
import { Pool } from "pg";
import * as schema from "./schema";

export function createDatabaseConnection() {
  const postgresUrl = process.env.POSTGRES_URL;

  if (!postgresUrl) {
    throw new Error("POSTGRES_URL environment variable is required");
  }

  if (postgresUrl.includes('localhost')) {
    const pool = new Pool({
      connectionString: postgresUrl,
    });
    return drizzleNode(pool, { schema });
  } else {
    return drizzle(sql, { schema });
  }
}

export function getDb() {
  return createDatabaseConnection();
}
