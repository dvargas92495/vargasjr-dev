#!/usr/bin/env tsx

import { execSync } from "child_process";
import { existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";

if (process.env.CI && !process.env.VERCEL) {
  const playwrightCachePath = join(homedir(), ".cache", "ms-playwright");

  if (existsSync(playwrightCachePath)) {
    console.log("Playwright browsers already cached, skipping installation...");
  } else {
    console.log("Installing Playwright browsers for CI environment...");
    execSync("npx playwright install --with-deps", { stdio: "inherit" });
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
