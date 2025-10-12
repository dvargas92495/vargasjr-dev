#!/usr/bin/env tsx

import { getFullCacheKey, downloadCacheFromS3 } from "./cache-utils";

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
  console.log(`Generated cache key: ${fullCacheKey}`);

  await downloadCacheFromS3(fullCacheKey);
}

handleCaching().catch((error) => {
  console.error("Error in preinstall caching:", error);
  process.exit(0);
});
