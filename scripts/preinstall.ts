#!/usr/bin/env tsx

import * as cache from "@actions/cache";
import { getFullCacheKey, getCachePaths, getRestoreKeys } from "./cache-utils";

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

  const fullCacheKey = getFullCacheKey();
  const cachePaths = getCachePaths();
  const restoreKeys = getRestoreKeys();

  console.log(`Generated cache key: ${fullCacheKey}`);
  console.log(`Cache paths: ${cachePaths.join(", ")}`);

  if (!process.env.ACTIONS_CACHE_URL) {
    console.log(
      "GitHub Actions cache service not configured, skipping cache restore"
    );
    return;
  }

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
  } catch (error) {
    console.warn("Cache restore failed:", error);
    console.log("Continuing without cache...");
  }
}

handleCaching().catch((error) => {
  console.error("Error in preinstall caching:", error);
  process.exit(0);
});
