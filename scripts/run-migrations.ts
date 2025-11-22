#!/usr/bin/env npx tsx

import { execSync } from "child_process";
import { existsSync, readdirSync, readFileSync } from "fs";
import { join } from "path";
import { postGitHubComment, getNeonPreviewDatabaseUrl } from "./utils";

async function sendSlackMessageToEng(
  text: string,
  blocks?: unknown
): Promise<void> {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) {
    console.warn("SLACK_BOT_TOKEN not set; skipping Slack notification");
    return;
  }

  const body: Record<string, unknown> = {
    channel: "eng",
    text,
  };

  if (blocks) {
    body.blocks = blocks;
  }

  try {
    const response = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const respText = await response.text().catch(() => "");
      console.error(
        `Slack API error (${response.status} ${response.statusText}):`,
        respText.slice(0, 500)
      );
    }
  } catch (error) {
    console.error("Failed to send Slack message:", error);
  }
}

function shouldNotifySlack(isPreviewMode: boolean): boolean {
  if (isPreviewMode) return false;

  const isCi = process.env.GITHUB_ACTIONS === "true";
  if (!isCi) return false;

  const ref = process.env.GITHUB_REF;
  const refName = process.env.GITHUB_REF_NAME;
  const isMain = ref === "refs/heads/main" || refName === "main";

  return isMain;
}

async function notifySlackOnMigrationFailure(
  error: unknown,
  isPreviewMode: boolean
): Promise<void> {
  if (!shouldNotifySlack(isPreviewMode)) {
    return;
  }

  const errorMessage =
    error instanceof Error ? error.message : String(error ?? "Unknown error");

  const serverUrl = process.env.GITHUB_SERVER_URL || "https://github.com";
  const repo = process.env.GITHUB_REPOSITORY ?? "dvargas92495/vargasjr-dev";
  const runId = process.env.GITHUB_RUN_ID;
  const commitSha = process.env.GITHUB_SHA;
  const refName = process.env.GITHUB_REF_NAME ?? "main";

  const actionUrl = runId ? `${serverUrl}/${repo}/actions/runs/${runId}` : "";
  const commitUrl = commitSha ? `${serverUrl}/${repo}/commit/${commitSha}` : "";

  const blocks = [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `⚠️ *Database Migration Failed*\n\nThe database migration workflow failed on the main branch.\n\n*Error:* ${errorMessage}`,
      },
    },
    {
      type: "section",
      fields: [
        {
          type: "mrkdwn",
          text: `*Repository:*\n${repo}`,
        },
        {
          type: "mrkdwn",
          text: `*Branch:*\n${refName}`,
        },
        ...(commitUrl
          ? [
              {
                type: "mrkdwn",
                text: `*Commit:*\n<${commitUrl}|${commitSha?.slice(0, 7)}>`,
              },
            ]
          : []),
        ...(actionUrl
          ? [
              {
                type: "mrkdwn",
                text: `*Workflow:*\n<${actionUrl}|View Action>`,
              },
            ]
          : []),
      ],
    },
  ];

  await sendSlackMessageToEng(
    "⚠️ Database migration failed on main branch",
    blocks
  );
}

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

      await notifySlackOnMigrationFailure(error, this.isPreviewMode).catch(
        (notifyError) => {
          console.error(
            "Failed to send Slack notification for migration failure:",
            notifyError
          );
        }
      );

      process.exit(1);
    }
  }

  private async introspectProductionDatabase(): Promise<void> {
    console.log("=== Introspecting production database schema ===");

    let postgresUrl = process.env.NEON_URL || process.env.POSTGRES_URL;

    if (this.isPreviewMode && !postgresUrl) {
      postgresUrl = await getNeonPreviewDatabaseUrl();
    }

    if (!postgresUrl) {
      throw new Error(
        "POSTGRES_URL environment variable is required or Neon API credentials must be provided for preview mode"
      );
    }

    try {
      execSync(
        `npx drizzle-kit introspect --dialect postgresql --out ${this.TEMP_DIR} --url "${postgresUrl}"`,
        {
          stdio: "inherit",
          cwd: process.cwd(),
        }
      );
    } catch (error) {
      throw new Error(`Failed to introspect production database: ${error}`);
    }
  }

  private async generateMigrationDiff(): Promise<void> {
    console.log("=== Generating migration diff ===");

    execSync(`mkdir -p ${this.TEMP_DIR}`, { cwd: process.cwd() });

    console.log("Generating new migrations from schema...");

    try {
      execSync(
        `npx drizzle-kit generate --schema ./db/schema.ts --dialect postgresql --out ${this.TEMP_DIR}`,
        {
          stdio: "inherit",
          cwd: process.cwd(),
        }
      );
    } catch (error) {
      console.log(
        "Note: drizzle-kit generate completed with warnings (this is normal)"
      );
    }

    let postgresUrl = process.env.NEON_URL || process.env.POSTGRES_URL;

    if (this.isPreviewMode && !postgresUrl) {
      postgresUrl = await getNeonPreviewDatabaseUrl();
    }

    if (!postgresUrl) {
      throw new Error(
        "POSTGRES_URL environment variable is required or Neon API credentials must be provided for preview mode"
      );
    }

    await this.displayMigrationFiles(postgresUrl);
  }

  private async handleNoMigrationsFound(): Promise<void> {
    const migrationContent =
      "✅ **No database migrations needed**\n\n" +
      "Your database schema is already up to date with the latest changes. No SQL statements need to be applied.\n";
    console.log("✅ No database migrations needed - schema is up to date");
    if (this.isPreviewMode) {
      await postGitHubComment(
        migrationContent,
        "vargasjr-dev-migration-script",
        "Posted migration preview comment to PR"
      );
    }
  }

  private async displayMigrationFiles(postgresUrl: string): Promise<void> {
    let migrationContent = "";

    const tempMigrationsDir = join(
      process.cwd(),
      this.TEMP_DIR.replace("./", "")
    );

    if (!existsSync(tempMigrationsDir)) {
      await this.handleNoMigrationsFound();
      return;
    }

    try {
      execSync(`ls -la ${tempMigrationsDir}/*.sql`, { stdio: "inherit" });
    } catch (error) {
      await this.handleNoMigrationsFound();
      return;
    }

    const migrationFiles = readdirSync(tempMigrationsDir)
      .filter((file) => file.endsWith(".sql"))
      .filter((file) => {
        const filePath = join(tempMigrationsDir, file);
        const fileContent = readFileSync(filePath, "utf8");
        return !fileContent.includes(
          "-- Current sql file was generated after introspecting"
        );
      })
      .sort();

    if (migrationFiles.length === 0) {
      await this.handleNoMigrationsFound();
      return;
    }

    migrationContent += "📋 **Database migrations to be applied:**\n\n";
    console.log("\n📋 Database migrations to be applied:");

    for (const migrationFile of migrationFiles) {
      const filePath = join(tempMigrationsDir, migrationFile);
      try {
        const fileContent = readFileSync(filePath, "utf8");
        migrationContent += fileContent;
        execSync(`cat "${filePath}"`, { stdio: "inherit" });
      } catch (error) {
        const errorMsg = `Failed to read migration file ${migrationFile}: ${error}`;
        migrationContent += errorMsg + "\n";
        console.error(errorMsg);
      }
    }

    migrationContent +=
      "\n✅ **End of migration preview** - The above SQL statements would be applied to update your database schema.\n";
    console.log("✅ End of migration preview");

    if (this.isPreviewMode) {
      await postGitHubComment(
        migrationContent,
        "vargasjr-dev-migration-script",
        "Posted migration preview comment to PR"
      );
    } else {
      console.log("🚀 Applying migrations to production database...");
      try {
        execSync(
          `npx drizzle-kit push --dialect postgresql --schema ./db/schema.ts --url "${postgresUrl}" --force`,
          {
            stdio: "inherit",
            cwd: process.cwd(),
          }
        );
        console.log(
          "✅ Migrations applied successfully to production database"
        );
      } catch (error) {
        throw new Error(`Failed to apply migrations: ${error}`);
      }
    }

    execSync(`rm -rf ${tempMigrationsDir}`, { cwd: process.cwd() });
  }
}

async function main() {
  const args = process.argv.slice(2);
  const isPreviewMode = args.includes("--preview");

  const runner = new MigrationRunner(isPreviewMode);
  await runner.runMigrations();
}

if (require.main === module) {
  main().catch(console.error);
}
