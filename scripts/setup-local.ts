#!/usr/bin/env node

import { execSync, spawn } from "child_process";
import { existsSync, writeFileSync, readFileSync, appendFileSync } from "fs";
import { join } from "path";

class LocalSetup {
  private envFilePath = join(process.cwd(), ".env");

  async run(): Promise<void> {
    console.log("🚀 Setting up local development environment...\n");

    if (this.isPostgresUrlSet()) {
      console.log("✅ POSTGRES_URL is already set in environment variables.");
      console.log("Local setup complete!");
      return;
    }

    if (await this.isLocalPostgresRunning()) {
      console.log("✅ Local PostgreSQL is running.");
      await this.setupLocalDatabase();
      return;
    }

    console.log("📦 Local PostgreSQL not found. Setting up...");
    await this.installAndSetupPostgres();
  }

  private isPostgresUrlSet(): boolean {
    const postgresUrl = process.env.NEON_URL || process.env.POSTGRES_URL;
    if (postgresUrl) {
      console.log(
        `Found POSTGRES_URL: ${postgresUrl.replace(/:[^:@]*@/, ":***@")}`
      );
      return true;
    }
    return false;
  }

  private async isLocalPostgresRunning(): Promise<boolean> {
    try {
      execSync("pg_isready -h localhost -p 5432", { stdio: "pipe" });
      return true;
    } catch (error) {
      try {
        execSync("systemctl is-active postgresql", { stdio: "pipe" });
        return true;
      } catch {
        try {
          execSync("brew services list | grep postgresql", { stdio: "pipe" });
          return true;
        } catch {
          return false;
        }
      }
    }
  }

  private async setupLocalDatabase(): Promise<void> {
    const dbName = "vargasjr_dev";
    const postgresUrl = `postgresql://postgres:password@localhost:5432/${dbName}`;

    try {
      console.log(`🔧 Setting up database: ${dbName}`);

      try {
        execSync(`sudo -u postgres createdb ${dbName}`, { stdio: "pipe" });
        console.log(`✅ Created database: ${dbName}`);
      } catch (error) {
        console.log(`ℹ️  Database ${dbName} may already exist, continuing...`);
      }

      try {
        execSync(`psql ${postgresUrl} -c "SELECT 1;"`, { stdio: "pipe" });
        console.log("✅ Database connection successful.");
      } catch (connectionError) {
        console.log("🔧 Testing connection to PostgreSQL server...");
        try {
          execSync(
            `psql postgresql://postgres:password@localhost:5432/postgres -c "SELECT 1;"`,
            { stdio: "pipe" }
          );
          console.log("✅ PostgreSQL server connection successful.");

          execSync(
            `psql postgresql://postgres:password@localhost:5432/postgres -c "CREATE DATABASE ${dbName};"`,
            { stdio: "pipe" }
          );
          console.log(`✅ Created database: ${dbName}`);

          execSync(`psql ${postgresUrl} -c "SELECT 1;"`, { stdio: "pipe" });
          console.log("✅ Database connection successful.");
        } catch (serverError) {
          throw connectionError; // Throw the original connection error
        }
      }

      this.addToEnvFile("POSTGRES_URL", postgresUrl);
      console.log("✅ Added POSTGRES_URL to .env file.");
      console.log("\n🎉 Local setup complete!");
      console.log(`Database URL: ${postgresUrl.replace(/:[^:@]*@/, ":***@")}`);
    } catch (error) {
      console.error("❌ Failed to set up local database:", error);
      console.log("\n💡 You may need to:");
      console.log(
        "   1. Start PostgreSQL service: sudo systemctl start postgresql"
      );
      console.log(
        "   2. Set a password for the postgres user: sudo -u postgres psql -c \"ALTER USER postgres PASSWORD 'password';\""
      );
      console.log(
        "   3. Manually create the database: sudo -u postgres createdb vargasjr_dev"
      );
      console.log("   4. Check PostgreSQL authentication configuration");
      process.exit(1);
    }
  }

  private async installAndSetupPostgres(): Promise<void> {
    const platform = process.platform;

    try {
      if (platform === "darwin") {
        await this.setupPostgresMacOS();
      } else if (platform === "linux") {
        await this.setupPostgresLinux();
      } else {
        console.log(
          "❌ Unsupported platform. Please install PostgreSQL manually."
        );
        console.log("Visit: https://www.postgresql.org/download/");
        process.exit(1);
      }
    } catch (error) {
      console.error("❌ Failed to install PostgreSQL:", error);
      console.log(
        "\n💡 Please install PostgreSQL manually and run this script again."
      );
      console.log("Visit: https://www.postgresql.org/download/");
      process.exit(1);
    }
  }

  private async setupPostgresMacOS(): Promise<void> {
    console.log("🍺 Installing PostgreSQL via Homebrew...");

    try {
      execSync("which brew", { stdio: "pipe" });
    } catch {
      console.log("❌ Homebrew not found. Please install Homebrew first:");
      console.log(
        '   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"'
      );
      process.exit(1);
    }

    execSync("brew install postgresql@15", { stdio: "inherit" });

    execSync("brew services start postgresql@15", { stdio: "inherit" });

    console.log("✅ PostgreSQL installed and started.");

    await new Promise((resolve) => setTimeout(resolve, 3000));

    await this.setupLocalDatabase();
  }

  private async setupPostgresLinux(): Promise<void> {
    console.log("🐧 Installing PostgreSQL on Linux...");

    try {
      execSync("which apt-get", { stdio: "pipe" });
      execSync("sudo apt-get update", { stdio: "inherit" });
      execSync("sudo apt-get install -y postgresql postgresql-contrib", {
        stdio: "inherit",
      });
    } catch {
      try {
        execSync("which yum", { stdio: "pipe" });
        execSync("sudo yum install -y postgresql postgresql-server", {
          stdio: "inherit",
        });
        execSync("sudo postgresql-setup initdb", { stdio: "inherit" });
      } catch {
        console.log(
          "❌ Could not detect package manager. Please install PostgreSQL manually."
        );
        process.exit(1);
      }
    }

    try {
      execSync("sudo systemctl start postgresql", { stdio: "inherit" });
      execSync("sudo systemctl enable postgresql", { stdio: "inherit" });
    } catch (error) {
      console.log("⚠️  Could not start PostgreSQL service automatically.");
      console.log("Please start it manually: sudo systemctl start postgresql");
    }

    console.log("✅ PostgreSQL installed and started.");

    await new Promise((resolve) => setTimeout(resolve, 5000));

    console.log("🔧 Setting up postgres user...");
    try {
      execSync(
        "sudo -u postgres psql -c \"ALTER USER postgres PASSWORD 'password';\"",
        { stdio: "inherit" }
      );
    } catch (error) {
      console.log("⚠️  Could not set postgres password automatically.");
      console.log(
        "Please set it manually: sudo -u postgres psql -c \"ALTER USER postgres PASSWORD 'password';\""
      );
    }

    await this.setupLocalDatabase();
  }

  private addToEnvFile(key: string, value: string): void {
    let envContent = "";

    if (existsSync(this.envFilePath)) {
      envContent = readFileSync(this.envFilePath, "utf8");

      const lines = envContent.split("\n");
      const existingLineIndex = lines.findIndex((line) =>
        line.startsWith(`${key}=`)
      );

      if (existingLineIndex !== -1) {
        lines[existingLineIndex] = `${key}=${value}`;
        envContent = lines.join("\n");
        writeFileSync(this.envFilePath, envContent);
        return;
      }
    }

    const newLine = `${key}=${value}\n`;
    if (envContent && !envContent.endsWith("\n")) {
      appendFileSync(this.envFilePath, "\n" + newLine);
    } else {
      appendFileSync(this.envFilePath, newLine);
    }
  }
}

if (require.main === module) {
  const setup = new LocalSetup();
  setup.run().catch((error) => {
    console.error("❌ Setup failed:", error);
    process.exit(1);
  });
}

export default LocalSetup;
