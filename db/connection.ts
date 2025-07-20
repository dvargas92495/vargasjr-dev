import { drizzle } from "drizzle-orm/vercel-postgres";
import { drizzle as drizzleNode } from "drizzle-orm/node-postgres";
import { drizzle as drizzleSQLite } from "drizzle-orm/better-sqlite3";
import { sql } from "@vercel/postgres";
import { Pool } from "pg";
import Database from "better-sqlite3";
import { join } from "path";
import * as schema from "./schema";
import * as sqliteSchema from "./sqlite-schema";

export function createDatabaseConnection() {
  const postgresUrl = process.env.POSTGRES_URL;

  if (!postgresUrl) {
    const dbPath = join(process.cwd(), 'local.db');
    const sqlite = new Database(dbPath);
    return drizzleSQLite(sqlite, { schema: sqliteSchema });
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
