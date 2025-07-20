import { drizzle } from "drizzle-orm/vercel-postgres";
import { drizzle as drizzleSQLite } from "drizzle-orm/better-sqlite3";
import { sql } from "@vercel/postgres";
import Database from "better-sqlite3";
import { join } from "path";
import * as dotenv from 'dotenv';
import * as schema from '../db/schema';
import * as sqliteSchema from '../db/sqlite-schema';

dotenv.config();

export function createDatabaseConnection() {
  const postgresUrl = process.env.POSTGRES_URL;

  if (!postgresUrl) {
    const dbPath = join(process.cwd(), 'local.db');
    const sqlite = new Database(dbPath);
    return drizzleSQLite(sqlite, { schema: sqliteSchema });
  }

  return drizzle(sql, { schema });
}

export function getDb() {
  return createDatabaseConnection();
}

export function postgresSession() {
  return getDb();
}
