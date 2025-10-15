#!/usr/bin/env tsx

import { getFullCacheKey, downloadCacheFromS3 } from "./cache-utils";
import { writeFileSync } from "fs";

async function handleCaching(): Promise<void> {
  const startTime = Date.now();

  if (!process.env.CI || process.env.VERCEL) {
    if (process.env.VERCEL) {
      console.log("Skipping cache setup (running in Vercel environment)");
    } else {
      console.log("Skipping cache setup (not in CI environment)");
    }
    return;
  }

  console.log("Setting up caching for CI environment...");

  const cacheKeyStartTime = Date.now();
  const fullCacheKey = getFullCacheKey();
  const cacheKeyDuration = ((Date.now() - cacheKeyStartTime) / 1000).toFixed(2);
  console.log(`Generated cache key: ${fullCacheKey} (${cacheKeyDuration}s)`);

  const cacheHit = await downloadCacheFromS3(fullCacheKey);

  const preinstallEndTime = Date.now();
  writeFileSync(
    "/tmp/cache-status.json",
    JSON.stringify({ cacheHit, cacheKey: fullCacheKey, preinstallEndTime })
  );

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(
    `Preinstall completed in ${duration}s (cache ${cacheHit ? "hit" : "miss"})`
  );
}

handleCaching().catch((error) => {
  console.error("Error in preinstall caching:", error);
  process.exit(0);
});
