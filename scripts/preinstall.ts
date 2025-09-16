#!/usr/bin/env tsx

import { execSync } from "child_process";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { createHash } from "crypto";

function createStableCacheKey(): string {
  const packageLockPath = join(process.cwd(), "package-lock.json");
  if (!existsSync(packageLockPath)) {
    throw new Error("package-lock.json not found");
  }

  const packageLock = JSON.parse(readFileSync(packageLockPath, "utf8"));

  const stablePackageLock = { ...packageLock };
  delete stablePackageLock.version;
  delete stablePackageLock.lockfileVersion;

  if (stablePackageLock.packages && stablePackageLock.packages[""]) {
    const rootPackage = { ...stablePackageLock.packages[""] };
    delete rootPackage.version;
    stablePackageLock.packages[""] = rootPackage;
  }

  const stableContent = JSON.stringify(stablePackageLock, null, 2);
  return createHash("sha256")
    .update(stableContent)
    .digest("hex")
    .substring(0, 16);
}

if (process.env.CI && !process.env.VERCEL) {
  console.log("Setting up caching for CI environment...");

  const cacheKey = createStableCacheKey();
  const fullCacheKey = `deps-${process.platform}-${cacheKey}`;

  if (process.env.GITHUB_OUTPUT) {
    const fs = require("fs");
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `cache-key=${fullCacheKey}\n`);
  }

  console.log(`Generated cache key: ${fullCacheKey}`);
} else {
  if (process.env.VERCEL) {
    console.log("Skipping cache setup (running in Vercel environment)");
  } else {
    console.log("Skipping cache setup (not in CI environment)");
  }
}
