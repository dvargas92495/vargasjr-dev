import { drizzle } from "drizzle-orm/vercel-postgres";
import { drizzle as drizzleNode } from "drizzle-orm/node-postgres";
import { sql } from "@vercel/postgres";
import { Pool } from "pg";

export function createDatabaseConnection() {
  const postgresUrl = process.env.NEON_URL || process.env.POSTGRES_URL;
  console.log("Creating database connection...");

  if (!postgresUrl) {
    console.error("Missing database URL environment variables");
    throw new Error("POSTGRES_URL environment variable is required");
  }

  console.log("Database URL configured:", postgresUrl.substring(0, 20) + "...");

  if (postgresUrl.includes("localhost")) {
    console.log("Using local PostgreSQL connection");
    const pool = new Pool({
      connectionString: postgresUrl,
    });
    return drizzleNode(pool);
  } else {
    console.log("Using Vercel PostgreSQL connection");
    return drizzle(sql);
  }
}

export function getDb() {
  return createDatabaseConnection();
}
