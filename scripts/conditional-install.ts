#!/usr/bin/env tsx

import { existsSync, readFileSync } from "fs";
import { execSync } from "child_process";

/**
 * Conditionally runs npm install based on cache status.
 * If cache was restored successfully, skips npm install to save time.
 * Otherwise, runs npm install normally.
 */
function conditionalInstall(): void {
  const cacheStatusPath = "/tmp/cache-status.json";

  if (!existsSync(cacheStatusPath)) {
    console.log("No cache status found, running npm install...");
    execSync("npm install", { stdio: "inherit" });
    return;
  }

  try {
    const cacheStatus = JSON.parse(readFileSync(cacheStatusPath, "utf8"));

    if (cacheStatus.cacheHit) {
      console.log(
        `✅ Cache hit detected (${cacheStatus.cacheKey}), skipping npm install`
      );
      console.log(
        "All dependencies already restored from cache, saving ~1 minute"
      );
      return;
    }

    console.log("Cache miss detected, running npm install...");
    execSync("npm install", { stdio: "inherit" });
  } catch (error) {
    console.warn("Error reading cache status, running npm install:", error);
    execSync("npm install", { stdio: "inherit" });
  }
}

conditionalInstall();
