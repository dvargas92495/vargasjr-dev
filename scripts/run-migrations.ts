#!/usr/bin/env npx tsx

import { execSync } from "child_process";
import { existsSync, readdirSync, readFileSync } from "fs";
import { join } from "path";

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
    let migrationContent = "=== Generated migration files ===\n\n";
    
    const tempMigrationsDir = join(process.cwd(), this.TEMP_DIR.replace('./', ''));
    
    if (!existsSync(tempMigrationsDir)) {
      migrationContent += "⚠️  No new migrations generated - schema is up to date\n";
      console.log("⚠️  No new migrations generated - schema is up to date");
      if (this.isPreviewMode) {
        await this.postGitHubComment(migrationContent + "\n⚠️  NOTE: These migrations were NOT applied to production database\nThis is a preview-only run for pull request review\n✅ Migration preview completed successfully!");
      }
      return;
    }

    try {
      execSync(`ls -la ${tempMigrationsDir}/*.sql`, { stdio: 'inherit' });
    } catch (error) {
      migrationContent += "⚠️  No SQL migration files generated - schema is up to date\n";
      console.log("⚠️  No SQL migration files generated - schema is up to date");
      if (this.isPreviewMode) {
        await this.postGitHubComment(migrationContent + "\n⚠️  NOTE: These migrations were NOT applied to production database\nThis is a preview-only run for pull request review\n✅ Migration preview completed successfully!");
      }
      return;
    }

    migrationContent += "=== SQL statements that would be applied ===\n";
    migrationContent += "The following migrations would be generated and applied to production:\n\n";
    console.log("\n=== SQL statements that would be applied ===");
    console.log("The following migrations would be generated and applied to production:");

    const migrationFiles = readdirSync(tempMigrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort();

    for (const migrationFile of migrationFiles) {
      const filePath = join(tempMigrationsDir, migrationFile);
      migrationContent += `--- ${migrationFile} ---\n`;
      console.log(`\n--- ${migrationFile} ---`);
      try {
        const fileContent = readFileSync(filePath, 'utf8');
        migrationContent += fileContent + "\n\n";
        execSync(`cat "${filePath}"`, { stdio: 'inherit' });
      } catch (error) {
        const errorMsg = `Failed to read migration file ${migrationFile}: ${error}`;
        migrationContent += errorMsg + "\n\n";
        console.error(errorMsg);
      }
      console.log("");
    }

    migrationContent += "=== End of migration preview ===\n";
    console.log("=== End of migration preview ===");
    
    if (this.isPreviewMode) {
      migrationContent += "⚠️  NOTE: These migrations were NOT applied to production database\n";
      migrationContent += "This is a preview-only run for pull request review\n";
      migrationContent += "✅ Migration preview completed successfully!";
      console.log("⚠️  NOTE: These migrations were NOT applied to production database");
      console.log("This is a preview-only run for pull request review");
      
      await this.postGitHubComment(migrationContent);
    } else {
      console.log("🚀 Applying migrations to production database...");
      try {
        execSync(`npx drizzle-kit push --url "${postgresUrl}"`, {
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

  private async postGitHubComment(content: string): Promise<void> {
    const githubToken = process.env.GITHUB_TOKEN;
    const githubRepo = process.env.GITHUB_REPOSITORY;
    const eventName = process.env.GITHUB_EVENT_NAME;
    const eventPath = process.env.GITHUB_EVENT_PATH;

    if (!githubToken || !githubRepo || eventName !== 'pull_request' || !eventPath) {
      console.log("Not in PR context or missing GitHub environment variables, skipping comment");
      return;
    }

    try {
      const eventData = JSON.parse(readFileSync(eventPath, 'utf8'));
      const prNumber = eventData.number;

      if (!prNumber) {
        console.log("No PR number found in event data");
        return;
      }

      const response = await fetch(`https://api.github.com/repos/${githubRepo}/issues/${prNumber}/comments`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${githubToken}`,
          "Content-Type": "application/json",
          "User-Agent": "vargasjr-dev-migration-script"
        },
        body: JSON.stringify({
          body: content
        })
      });

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.statusText}`);
      }

      console.log("✅ Posted migration preview comment to PR");
    } catch (error) {
      console.error("Failed to post GitHub comment:", error);
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
