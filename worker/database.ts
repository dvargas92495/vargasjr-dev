import { drizzle } from "drizzle-orm/vercel-postgres";
import { sql } from "@vercel/postgres";
import * as dotenv from 'dotenv';
import * as schema from '../db/schema';

dotenv.config();

export function createDatabaseConnection() {
  const postgresUrl = process.env.POSTGRES_URL;

  if (!postgresUrl) {
    throw new Error("POSTGRES_URL environment variable is required");
  }

  return drizzle(sql, { schema });
}

export function getDb() {
  return createDatabaseConnection();
}

export function postgresSession() {
  return getDb();
}
