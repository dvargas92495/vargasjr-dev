#!/usr/bin/env tsx

import { existsSync } from "fs";
import { execSync } from "child_process";
import { join } from "path";
import { downloadCacheFromS3, getFullCacheKey, uploadCacheToS3 } from "./cache-utils";

async function conditionalInstall(): Promise<void> {
  if (!process.env.CI || process.env.VERCEL) {
    console.log("Not in CI or running in Vercel, running npm install...");
    execSync("npm install", { stdio: "inherit" });
    return;
  }

  console.log("Attempting to restore cache from S3...");
  const cacheKey = getFullCacheKey();
  const cacheHit = await downloadCacheFromS3(cacheKey);

  const nodeModulesPath = join(process.cwd(), "node_modules");
  const hasValidNodeModules = existsSync(nodeModulesPath) && existsSync(join(nodeModulesPath, ".package-lock.json"));

  if (cacheHit && hasValidNodeModules) {
    console.log("✅ Cache hit: node_modules restored, skipping npm install");
    console.log("Saving ~1 minute by skipping dependency installation");
    
    execSync("npm run postinstall", { stdio: "inherit" });
  } else {
    if (!cacheHit) {
      console.log("Cache miss: running full npm install...");
    } else {
      console.log("Cache incomplete: running full npm install...");
    }
    
    execSync("npm install --ignore-scripts", { stdio: "inherit" });
    execSync("npm run postinstall", { stdio: "inherit" });
    
    if (!cacheHit) {
      console.log("Uploading cache to S3...");
      await uploadCacheToS3(cacheKey);
    }
  }
}

conditionalInstall().catch((error) => {
  console.error("Error in conditional install:", error);
  process.exit(1);
});
