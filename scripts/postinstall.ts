#!/usr/bin/env tsx

import { execSync } from "child_process";

if (process.env.CI && !process.env.VERCEL) {
  console.log("Installing Playwright browsers for CI environment...");
  execSync("npx playwright install --with-deps", { stdio: "inherit" });
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
