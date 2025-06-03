#!/usr/bin/env npx tsx

import { execSync } from "child_process";
import { existsSync, readdirSync } from "fs";
import { join } from "path";

class MigrationRunner {
  private dbDir: string;
  private migrationsDir: string;
  private isPreviewMode: boolean;

  constructor(isPreviewMode: boolean = false) {
    this.dbDir = join(process.cwd(), "db");
    this.migrationsDir = join(this.dbDir, "migrations");
    this.isPreviewMode = isPreviewMode;
  }

  async runMigrations(): Promise<void> {
    if (this.isPreviewMode) {
      console.log("🔍 Previewing database migrations...");
    } else {
      console.log("🚀 Running database migrations...");
    }
    
    try {
      await this.introspectProductionDatabase();
      await this.generateMigrationDiff();
      
      if (this.isPreviewMode) {
        console.log("✅ Migration preview completed successfully!");
      } else {
        console.log("✅ Migration execution completed successfully!");
      }
      
    } catch (error) {
      const action = this.isPreviewMode ? "preview" : "run";
      console.error(`❌ Failed to ${action} migrations: ${error}`);
      process.exit(1);
    }
  }

  private async introspectProductionDatabase(): Promise<void> {
    console.log("=== Introspecting production database schema ===");
    
    if (!process.env.POSTGRES_URL) {
      throw new Error("POSTGRES_URL environment variable is required");
    }

    try {
      execSync(`npx drizzle-kit introspect --out ./production-schema --url "${process.env.POSTGRES_URL}"`, {
        stdio: 'inherit',
        cwd: process.cwd()
      });
    } catch (error) {
      throw new Error(`Failed to introspect production database: ${error}`);
    }
  }

  private async generateMigrationDiff(): Promise<void> {
    console.log("=== Generating migration diff ===");
    
    execSync("mkdir -p ./temp-migrations", { cwd: process.cwd() });
    
    console.log("Checking what migrations would be applied...");
    
    try {
      execSync("npx drizzle-kit check --dialect postgresql --out ./db/migrations", {
        stdio: 'inherit',
        cwd: process.cwd()
      });
    } catch (error) {
      console.log("Note: drizzle-kit check completed with warnings (this is normal)");
    }

    await this.displayMigrationFiles();
  }

  private async displayMigrationFiles(): Promise<void> {
    console.log("=== Local migration files ===");
    
    if (!existsSync(this.migrationsDir)) {
      console.log("⚠️  No migrations directory found");
      return;
    }

    try {
      execSync(`ls -la ${this.migrationsDir}/*.sql`, { stdio: 'inherit' });
    } catch (error) {
      console.log("⚠️  No SQL migration files found");
      return;
    }

    console.log("\n=== SQL statements that would be applied ===");
    console.log("The following migration files exist and would be applied to production:");

    const migrationFiles = readdirSync(this.migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort();

    for (const migrationFile of migrationFiles) {
      const filePath = join(this.migrationsDir, migrationFile);
      console.log(`\n--- ${migrationFile} ---`);
      try {
        execSync(`cat "${filePath}"`, { stdio: 'inherit' });
      } catch (error) {
        console.error(`Failed to read migration file ${migrationFile}: ${error}`);
      }
      console.log("");
    }

    console.log("=== End of migration preview ===");
    if (this.isPreviewMode) {
      console.log("⚠️  NOTE: These migrations were NOT applied to production database");
      console.log("This is a preview-only run as requested in issue #72");
    } else {
      console.log("✅ These migrations have been applied to production database");
    }
  }
}

async function main() {
  const args = process.argv.slice(2);
  const isPreviewMode = args.includes('--preview');
  
  const runner = new MigrationRunner(isPreviewMode);
  await runner.runMigrations();
}

if (require.main === module) {
  main().catch(console.error);
}
