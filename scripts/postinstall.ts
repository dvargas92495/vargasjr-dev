#!/usr/bin/env tsx

import { execSync } from "child_process";

if (process.env.CI) {
  console.log("Installing Playwright browsers for CI environment...");
  execSync("npx playwright install --with-deps", { stdio: "inherit" });
} else {
  console.log(
    "Skipping Playwright browser installation (not in CI environment)"
  );
}
