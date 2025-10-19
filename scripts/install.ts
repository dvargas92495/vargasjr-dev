#!/usr/bin/env tsx

import { existsSync } from "fs";
import { execSync } from "child_process";
import { join } from "path";

function conditionalInstall(): void {
  if (process.env.SKIP_CUSTOM_INSTALL) {
    console.log("SKIP_CUSTOM_INSTALL set, running default npm install");
    return;
  }

  if (!process.env.CI || process.env.VERCEL) {
    console.log("Not in CI or running in Vercel, running npm install...");
    execSync("SKIP_CUSTOM_INSTALL=1 npm install --ignore-scripts", {
      stdio: "inherit",
      shell: "/bin/bash",
    });
    execSync("npm run postinstall", { stdio: "inherit" });
    return;
  }

  const nodeModulesPath = join(process.cwd(), "node_modules");
  const hasValidNodeModules =
    existsSync(nodeModulesPath) &&
    existsSync(join(nodeModulesPath, ".package-lock.json"));

  if (hasValidNodeModules) {
    console.log(
      "✅ node_modules already present (restored by preinstall cache), skipping npm install"
    );
    console.log("Saving ~1 minute by skipping dependency installation");
    console.log("Running postinstall for environment setup...");
    execSync("npm run postinstall", { stdio: "inherit" });
  } else {
    console.log("node_modules not found, running full npm install...");
    execSync("SKIP_CUSTOM_INSTALL=1 npm install --ignore-scripts", {
      stdio: "inherit",
      shell: "/bin/bash",
    });
    execSync("npm run postinstall", { stdio: "inherit" });
  }
}

conditionalInstall();
