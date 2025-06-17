#!/usr/bin/env npx tsx

import { execSync } from "child_process";
import { existsSync, readdirSync, readFileSync } from "fs";
import { join } from "path";
import { postGitHubComment } from "./utils";

class MigrationRunner {
  private dbDir: string;
  private isPreviewMode: boolean;
  private readonly TEMP_DIR = "./migrations-temp";

  constructor(isPreviewMode: boolean = false) {
    this.dbDir = join(process.cwd(), "db");
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
    
    let postgresUrl = process.env.POSTGRES_URL;
    
    if (this.isPreviewMode && !postgresUrl) {
      postgresUrl = await this.getNeonPreviewDatabaseUrl();
    }
    
    if (!postgresUrl) {
      throw new Error("POSTGRES_URL environment variable is required or Neon API credentials must be provided for preview mode");
    }

    try {
      execSync(`npx drizzle-kit introspect --dialect postgresql --out ${this.TEMP_DIR} --url "${postgresUrl}"`, {
        stdio: 'inherit',
        cwd: process.cwd()
      });
    } catch (error) {
      throw new Error(`Failed to introspect production database: ${error}`);
    }
  }

  private async getNeonPreviewDatabaseUrl(): Promise<string> {
    const neonApiKey = process.env.NEON_API_KEY;
    const branchName = process.env.GITHUB_HEAD_REF || process.env.BRANCH_NAME;
    const projectId = "fancy-sky-34733112";
    
    if (!neonApiKey) {
      throw new Error("NEON_API_KEY environment variable is required for preview mode");
    }
    
    if (!branchName) {
      throw new Error("GITHUB_HEAD_REF or BRANCH_NAME environment variable is required for preview mode");
    }
    
    const fullBranchName = `preview/${branchName}`;
    console.log(`🔍 Fetching database URL for branch: ${fullBranchName}`);
    
    try {
      const branchResponse = await fetch(`https://console.neon.tech/api/v2/projects/${projectId}/branches`, {
        headers: {
          "Authorization": `Bearer ${neonApiKey}`,
          "Content-Type": "application/json"
        }
      });
      
      if (!branchResponse.ok) {
        throw new Error(`Failed to fetch branches: ${branchResponse.statusText}`);
      }
      
      const branchData = await branchResponse.json();
      const branch = branchData.branches?.find((b: any) => b.name === fullBranchName);
      
      if (!branch) {
        throw new Error(`Branch '${fullBranchName}' not found`);
      }
      
      const branchId = branch.id;
      console.log(`✅ Found branch ID: ${branchId}`);
      
      const connectionResponse = await fetch(
        `https://console.neon.tech/api/v2/projects/${projectId}/connection_uri?branch_id=${branchId}&database_name=verceldb&role_name=default`,
        {
          headers: {
            "Authorization": `Bearer ${neonApiKey}`,
            "Content-Type": "application/json"
          }
        }
      );
      
      if (!connectionResponse.ok) {
        throw new Error(`Failed to fetch connection URI: ${connectionResponse.statusText}`);
      }
      
      const connectionData = await connectionResponse.json();
      const postgresUrl = connectionData.uri;
      
      if (!postgresUrl) {
        throw new Error("No connection URI found in response");
      }
      
      console.log(`✅ Retrieved database URL for preview branch`);
      return postgresUrl;
      
    } catch (error) {
      throw new Error(`Failed to get Neon database URL: ${error}`);
    }
  }

  private async generateMigrationDiff(): Promise<void> {
    console.log("=== Generating migration diff ===");
    
    execSync(`mkdir -p ${this.TEMP_DIR}`, { cwd: process.cwd() });
    
    console.log("Generating new migrations from schema...");
    
    try {
      execSync(`npx drizzle-kit generate --schema ./db/schema.ts --dialect postgresql --out ${this.TEMP_DIR}`, {
        stdio: 'inherit',
        cwd: process.cwd()
      });
    } catch (error) {
      console.log("Note: drizzle-kit generate completed with warnings (this is normal)");
    }

    let postgresUrl = process.env.POSTGRES_URL;
    
    if (this.isPreviewMode && !postgresUrl) {
      postgresUrl = await this.getNeonPreviewDatabaseUrl();
    }
    
    if (!postgresUrl) {
      throw new Error("POSTGRES_URL environment variable is required or Neon API credentials must be provided for preview mode");
    }

    await this.displayMigrationFiles(postgresUrl);
  }

  private async displayMigrationFiles(postgresUrl: string): Promise<void> {
    let migrationContent = "";
    
    const tempMigrationsDir = join(process.cwd(), this.TEMP_DIR.replace('./', ''));
    
    if (!existsSync(tempMigrationsDir)) {
      migrationContent += "=== SQL statements that would be applied ===\n";
      migrationContent += "⚠️  No new migrations generated - schema is up to date\n";
      migrationContent += "=== End of migration preview ===";
      console.log("⚠️  No new migrations generated - schema is up to date");
      if (this.isPreviewMode) {
        await postGitHubComment(migrationContent, "vargasjr-dev-migration-script", "Posted migration preview comment to PR");
      }
      return;
    }

    try {
      execSync(`ls -la ${tempMigrationsDir}/*.sql`, { stdio: 'inherit' });
    } catch (error) {
      migrationContent += "=== SQL statements that would be applied ===\n";
      migrationContent += "⚠️  No SQL migration files generated - schema is up to date\n";
      migrationContent += "=== End of migration preview ===";
      console.log("⚠️  No SQL migration files generated - schema is up to date");
      if (this.isPreviewMode) {
        await postGitHubComment(migrationContent, "vargasjr-dev-migration-script", "Posted migration preview comment to PR");
      }
      return;
    }

    migrationContent += "=== SQL statements that would be applied ===\n";
    console.log("\n=== SQL statements that would be applied ===");

    const migrationFiles = readdirSync(tempMigrationsDir)
      .filter(file => file.endsWith('.sql'))
      .filter(file => {
        const filePath = join(tempMigrationsDir, file);
        const fileContent = readFileSync(filePath, 'utf8');
        return !fileContent.includes('-- Current sql file was generated after introspecting');
      })
      .sort();

    for (const migrationFile of migrationFiles) {
      const filePath = join(tempMigrationsDir, migrationFile);
      try {
        const fileContent = readFileSync(filePath, 'utf8');
        migrationContent += fileContent;
        execSync(`cat "${filePath}"`, { stdio: 'inherit' });
      } catch (error) {
        const errorMsg = `Failed to read migration file ${migrationFile}: ${error}`;
        migrationContent += errorMsg + "\n";
        console.error(errorMsg);
      }
    }

    migrationContent += "\n=== End of migration preview ===";
    console.log("=== End of migration preview ===");
    
    if (this.isPreviewMode) {
      await postGitHubComment(migrationContent, "vargasjr-dev-migration-script", "Posted migration preview comment to PR");
    } else {
      console.log("🚀 Applying migrations to production database...");
      try {
        execSync(`npx drizzle-kit push --dialect postgresql --schema ./db/schema.ts --url "${postgresUrl}" --force`, {
          stdio: 'inherit',
          cwd: process.cwd()
        });
        console.log("✅ Migrations applied successfully to production database");
      } catch (error) {
        throw new Error(`Failed to apply migrations: ${error}`);
      }
    }
    
    execSync(`rm -rf ${tempMigrationsDir}`, { cwd: process.cwd() });
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
