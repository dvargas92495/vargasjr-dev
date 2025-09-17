#!/usr/bin/env tsx

import { execSync } from "child_process";
import { existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import * as cache from "@actions/cache";

async function handlePostInstall(): Promise<void> {
  if (process.env.CI && !process.env.VERCEL) {
    const playwrightCachePath = join(homedir(), ".cache", "ms-playwright");

    if (existsSync(playwrightCachePath)) {
      console.log(
        "Playwright browsers already cached, skipping installation..."
      );
    } else {
      console.log("Installing Playwright browsers for CI environment...");
      execSync("npx playwright install --with-deps", { stdio: "inherit" });
    }

    if (process.env.CACHE_KEY && process.env.CACHE_PATHS) {
      try {
        console.log("Saving cache...");
        const cachePaths = process.env.CACHE_PATHS.split(",");
        const cacheId = await cache.saveCache(
          cachePaths,
          process.env.CACHE_KEY
        );
        console.log(`Cache saved with ID: ${cacheId}`);
      } catch (error) {
        console.warn("Cache save failed:", error);
      }
    }
  } else {
    if (process.env.VERCEL) {
      console.log(
        "Skipping Playwright browser installation (running in Vercel environment)"
      );
    } else {
      console.log(
        "Skipping Playwright browser installation (not in CI environment)"
      );
    }
  }
}

handlePostInstall().catch((error) => {
  console.error("Error in postinstall:", error);
  process.exit(0);
});
