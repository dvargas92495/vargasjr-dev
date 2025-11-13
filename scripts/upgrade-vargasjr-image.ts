#!/usr/bin/env npx tsx

import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

class VargasJRImageUpgrader {
  private agentDir: string;
  private lockFilePath: string;

  constructor() {
    this.agentDir = join(process.cwd(), "vellum");
    this.lockFilePath = join(this.agentDir, "vellum.lock.json");
  }

  async upgradeImage(): Promise<void> {
    console.log("🔄 Upgrading vargasjr container image version...");

    try {
      if (!existsSync(this.lockFilePath)) {
        throw new Error(
          "vellum.lock.json not found. Make sure you're running this from the project root."
        );
      }

      const lockFileContent = JSON.parse(
        readFileSync(this.lockFilePath, "utf8")
      );

      if (
        !lockFileContent.workflows ||
        !Array.isArray(lockFileContent.workflows) ||
        lockFileContent.workflows.length === 0
      ) {
        throw new Error(
          "Invalid vellum.lock.json format: no workflows found"
        );
      }

      const currentTag =
        lockFileContent.workflows[0]?.container_image_tag || "1.0.0";
      const newTag = this.incrementPatchVersion(currentTag);

      console.log(`📦 Current image version: ${currentTag}`);
      console.log(`📦 New image version: ${newTag}`);

      this.updateLockFileTag(lockFileContent, newTag);
      writeFileSync(
        this.lockFilePath,
        JSON.stringify(lockFileContent, null, 2) + "\n"
      );

      console.log(`✅ Successfully updated vellum.lock.json with tag: ${newTag}`);
      console.log(
        "\n📝 Next steps:"
      );
      console.log("   1. Commit the vellum.lock.json changes");
      console.log("   2. Push your changes to trigger the workflow deployment");
      console.log(
        "   3. The CI will automatically build and push the new container image"
      );
    } catch (error) {
      console.error(`❌ Failed to upgrade image version: ${error}`);
      process.exit(1);
    }
  }

  private incrementPatchVersion(version: string): string {
    const parts = version.split(".");
    if (parts.length !== 3) {
      throw new Error(`Invalid version format: ${version}`);
    }

    const major = parseInt(parts[0]);
    const minor = parseInt(parts[1]);
    const patch = parseInt(parts[2]) + 1;

    return `${major}.${minor}.${patch}`;
  }

  private updateLockFileTag(lockFileContent: any, newTag: string): void {
    if (lockFileContent.workflows && Array.isArray(lockFileContent.workflows)) {
      lockFileContent.workflows.forEach((workflow: any) => {
        if (workflow.container_image_name === "vargasjr") {
          workflow.container_image_tag = newTag;
        } else if (
          workflow.container_image_name === null ||
          workflow.container_image_name === undefined
        ) {
          workflow.container_image_name = "vargasjr";
          workflow.container_image_tag = newTag;
        }
      });
    }
  }
}

async function main() {
  const upgrader = new VargasJRImageUpgrader();
  await upgrader.upgradeImage();
}

if (require.main === module) {
  main().catch(console.error);
}
