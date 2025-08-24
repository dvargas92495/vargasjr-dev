#!/usr/bin/env npx tsx

import { execSync } from "child_process";
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

class VersionSync {
  private packageJsonPath = join(process.cwd(), "package.json");
  private pyprojectTomlPath = join(process.cwd(), "vellum", "pyproject.toml");

  async run(): Promise<void> {
    console.log("🔄 Syncing version from package.json to pyproject.toml...");

    try {
      const packageJson = JSON.parse(
        readFileSync(this.packageJsonPath, "utf8")
      );
      const packageVersion = packageJson.version;

      if (!packageVersion) {
        throw new Error("No version found in package.json");
      }

      console.log(`📦 Package.json version: ${packageVersion}`);

      const pyprojectContent = readFileSync(this.pyprojectTomlPath, "utf8");

      const lines = pyprojectContent.split("\n");
      const versionLineIndex = lines.findIndex((line) =>
        line.startsWith("version = ")
      );

      if (versionLineIndex === -1) {
        throw new Error("Version line not found in pyproject.toml");
      }

      const oldVersion = lines[versionLineIndex]
        .split("=")[1]
        .trim()
        .replace(/"/g, "");
      lines[versionLineIndex] = `version = "${packageVersion}"`;

      writeFileSync(this.pyprojectTomlPath, lines.join("\n"));

      console.log(
        `✅ Updated pyproject.toml version: ${oldVersion} → ${packageVersion}`
      );

      execSync(`git add ${this.pyprojectTomlPath}`);
      execSync(`git commit --amend --no-edit`);
      console.log("🎉 Version sync complete!");
    } catch (error) {
      console.error("❌ Failed to sync version:", error);
      process.exit(1);
    }
  }
}

if (require.main === module) {
  const sync = new VersionSync();
  sync.run().catch((error) => {
    console.error("❌ Version sync failed:", error);
    process.exit(1);
  });
}

export default VersionSync;
