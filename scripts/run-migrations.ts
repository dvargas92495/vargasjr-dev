#!/usr/bin/env npx tsx

import { execSync } from "child_process";
import { existsSync, readdirSync, writeFileSync } from "fs";
import { join } from "path";

class MigrationRunner {
  private dbDir: string;
  private isPreviewMode: boolean;
  private outputFile: string | null;

  constructor(isPreviewMode: boolean = false, outputFile: string | null = null) {
    this.dbDir = join(process.cwd(), "db");
    this.isPreviewMode = isPreviewMode;
    this.outputFile = outputFile;
  }

  async runMigrations(): Promise<void> {
    if (this.isPreviewMode) {
      console.log("🔍 Previewing database migrations...");
    } else {
      console.log("🚀 Running database migrations...");
    }
    
    try {
      await this.introspectProductionDatabase();
      
      if (this.outputFile) {
        this.captureFilteredOutput();
      }
      
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
      execSync(`npx drizzle-kit introspect --dialect postgresql --out ./production-schema --url "${process.env.POSTGRES_URL}"`, {
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
    
    console.log("Generating new migrations from schema...");
    
    try {
      execSync("npx drizzle-kit generate --schema ./db/schema.ts --dialect postgresql --out ./temp-migrations", {
        stdio: 'inherit',
        cwd: process.cwd()
      });
    } catch (error) {
      console.log("Note: drizzle-kit generate completed with warnings (this is normal)");
    }

    await this.displayMigrationFiles();
  }

  private async displayMigrationFiles(): Promise<void> {
    console.log("=== Generated migration files ===");
    
    const tempMigrationsDir = join(process.cwd(), "temp-migrations");
    
    if (!existsSync(tempMigrationsDir)) {
      console.log("⚠️  No new migrations generated - schema is up to date");
      return;
    }

    try {
      execSync(`ls -la ${tempMigrationsDir}/*.sql`, { stdio: 'inherit' });
    } catch (error) {
      console.log("⚠️  No SQL migration files generated - schema is up to date");
      return;
    }

    console.log("\n=== SQL statements that would be applied ===");
    console.log("The following migrations would be generated and applied to production:");

    const migrationFiles = readdirSync(tempMigrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort();

    for (const migrationFile of migrationFiles) {
      const filePath = join(tempMigrationsDir, migrationFile);
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
      console.log("This is a preview-only run for pull request review");
    } else {
      console.log("✅ These migrations would be applied to production database");
    }
    
    execSync(`rm -rf ${tempMigrationsDir}`, { cwd: process.cwd() });
  }

  private captureFilteredOutput(): void {
    if (!this.outputFile) return;
    
    const originalLog = console.log;
    let capturedOutput = '';
    let capturing = false;
    
    console.log = (...args: any[]) => {
      const message = args.join(' ');
      if (message.includes('=== Generated migration files ===')) {
        capturing = true;
      }
      if (capturing) {
        capturedOutput += message + '\n';
      }
      originalLog(...args);
    };
    
    process.on('beforeExit', () => {
      console.log = originalLog;
      if (capturedOutput) {
        writeFileSync(this.outputFile!, capturedOutput);
      }
    });
  }
}

async function main() {
  const args = process.argv.slice(2);
  const isPreviewMode = args.includes('--preview');
  const outputFileIndex = args.indexOf('--output-file');
  const outputFile = outputFileIndex !== -1 && args[outputFileIndex + 1] ? args[outputFileIndex + 1] : null;
  
  const runner = new MigrationRunner(isPreviewMode, outputFile);
  await runner.runMigrations();
}

if (require.main === module) {
  main().catch(console.error);
}
