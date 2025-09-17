#!/usr/bin/env tsx

import { execSync } from "child_process";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { createHash } from "crypto";
import * as cache from "@actions/cache";

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

async function handleCaching(): Promise<void> {
  if (!process.env.CI || process.env.VERCEL) {
    if (process.env.VERCEL) {
      console.log("Skipping cache setup (running in Vercel environment)");
    } else {
      console.log("Skipping cache setup (not in CI environment)");
    }
    return;
  }

  console.log("Setting up caching for CI environment...");

  const cacheKey = createStableCacheKey();
  const fullCacheKey = `deps-${process.platform}-${cacheKey}`;
  const restoreKeys = [`deps-${process.platform}-`];

  const cachePaths = [
    join(homedir(), ".npm"),
    join(homedir(), ".cache", "ms-playwright"),
  ];

  console.log(`Generated cache key: ${fullCacheKey}`);
  console.log(`Cache paths: ${cachePaths.join(", ")}`);

  try {
    console.log("Attempting to restore cache...");
    const restoredKey = await cache.restoreCache(
      cachePaths,
      fullCacheKey,
      restoreKeys
    );

    if (restoredKey) {
      console.log(`Cache restored with key: ${restoredKey}`);
    } else {
      console.log("No cache found, will create new cache after install");
    }

    process.env.CACHE_KEY = fullCacheKey;
    process.env.CACHE_PATHS = cachePaths.join(",");
  } catch (error) {
    console.warn("Cache restore failed:", error);
    console.log("Continuing without cache...");
  }
}

handleCaching().catch((error) => {
  console.error("Error in preinstall caching:", error);
  process.exit(0);
});
