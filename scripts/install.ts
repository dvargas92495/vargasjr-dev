#!/usr/bin/env tsx

import { existsSync, readFileSync } from "fs";
import { execSync } from "child_process";

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
    return;
  }

  let cacheHit = false;
  try {
    const cacheStatusPath = "/tmp/cache-status.json";
    if (existsSync(cacheStatusPath)) {
      const cacheStatus = JSON.parse(readFileSync(cacheStatusPath, "utf8"));
      cacheHit = cacheStatus.cacheHit === true;
    }
  } catch (error) {
    console.warn("Could not read cache status:", error);
  }

  if (cacheHit) {
    console.log(
      "✅ Cache hit detected (node_modules restored by preinstall), skipping npm install"
    );
    console.log("Saving ~1 minute by skipping dependency installation");
    console.log("Running postinstall for environment setup...");
    execSync("npm run postinstall", { stdio: "inherit" });
  } else {
    console.log("Cache miss, running full npm install...");
    execSync("SKIP_CUSTOM_INSTALL=1 npm install --ignore-scripts", {
      stdio: "inherit",
      shell: "/bin/bash",
    });
    execSync("npm run postinstall", { stdio: "inherit" });
  }
}

conditionalInstall();
