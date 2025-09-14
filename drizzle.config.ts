import type { Config } from "drizzle-kit";

const databaseUrl = process.env.NEON_URL || process.env.POSTGRES_URL;

if (!databaseUrl) {
  if (
    process.env.NODE_ENV === "test" ||
    process.argv.some((arg) => arg.includes("knip"))
  ) {
    console.warn("Using dummy database URL for static analysis");
  } else {
    throw new Error("POSTGRES_URL is not set");
  }
}

export default {
  schema: "./db/schema.ts",
  out: "./db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl || "postgresql://dummy:dummy@localhost:5432/dummy",
  },
} satisfies Config;
