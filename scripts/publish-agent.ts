#!/usr/bin/env npx tsx

import { readFileSync } from "fs";
import { execSync } from "child_process";
import { join } from "path";

class AgentPublisher {
  private getVersion(): string {
    const packageJsonPath = join(process.cwd(), "package.json");
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
    return packageJson.version;
  }

  async run(): Promise<void> {
    const version = this.getVersion();
    const packageName = `vargasjr_dev_agent-${version}`;

    console.log(`📦 Creating agent package version ${version}...`);

    try {
      execSync(`mkdir -p ${packageName}`, { stdio: "inherit" });

      execSync(`cp -r vellum/models ${packageName}/models`, {
        stdio: "inherit",
      });
      execSync(`cp -r vellum/services ${packageName}/services`, {
        stdio: "inherit",
      });
      execSync(`cp -r vellum/workflows ${packageName}/workflows`, {
        stdio: "inherit",
      });
      execSync(`cp vellum/pyproject.toml ${packageName}/pyproject.toml`, {
        stdio: "inherit",
      });

      execSync(`mkdir -p ${packageName}/dist`, { stdio: "inherit" });
      execSync(`cp dist/browser.js ${packageName}/dist/browser.js`, {
        stdio: "inherit",
      });
      execSync(`cp dist/worker.js ${packageName}/dist/worker.js`, {
        stdio: "inherit",
      });
      execSync(`cp -r scripts ${packageName}/scripts`, { stdio: "inherit" });
      execSync(`cp -r db ${packageName}/db`, { stdio: "inherit" });
      execSync(`cp -r server ${packageName}/server`, { stdio: "inherit" });
      execSync(`cp package.json ${packageName}/package.json`, {
        stdio: "inherit",
      });

      execSync(`tar -czf ${packageName}.tar.gz ${packageName}`, {
        stdio: "inherit",
      });

      console.log(`✅ Agent package created: ${packageName}.tar.gz`);
    } catch (error) {
      console.error("❌ Failed to create agent package:", error);
      process.exit(1);
    }
  }
}

if (require.main === module) {
  const publisher = new AgentPublisher();
  publisher.run().catch((error) => {
    console.error("❌ Agent publishing failed:", error);
    process.exit(1);
  });
}

export default AgentPublisher;
