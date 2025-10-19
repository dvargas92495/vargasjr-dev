#!/usr/bin/env tsx

import { getFullCacheKey, downloadCacheFromS3, getCachePaths } from "./cache-utils";
import { writeFileSync } from "fs";
import { execSync } from "child_process";
import { existsSync } from "fs";
import { homedir } from "os";

async function handleCaching(): Promise<void> {
  const isAnalyze = process.env.ANALYZE === "true";
  const startTime = isAnalyze ? Date.now() : 0;

  if (!process.env.CI || process.env.VERCEL) {
    if (process.env.VERCEL) {
      console.log("Skipping cache setup (running in Vercel environment)");
    } else {
      console.log("Skipping cache setup (not in CI environment)");
    }
    return;
  }

  console.log("Setting up caching for CI environment...");

  const cacheKeyStartTime = isAnalyze ? Date.now() : 0;
  const fullCacheKey = getFullCacheKey();
  if (isAnalyze) {
    const cacheKeyDuration = ((Date.now() - cacheKeyStartTime) / 1000).toFixed(2);
    console.log(`Generated cache key: ${fullCacheKey} (${cacheKeyDuration}s)`);
  } else {
    console.log(`Generated cache key: ${fullCacheKey}`);
  }

  const cacheHit = await downloadCacheFromS3(fullCacheKey);

  if (isAnalyze && cacheHit) {
    console.log("\nAnalyzing cache directory sizes...");
    const cachePaths = getCachePaths();
    const directorySizes: { path: string; size: number; sizeFormatted: string }[] = [];

    for (const cachePath of cachePaths) {
      if (existsSync(cachePath)) {
        try {
          const topLevelDirs = execSync(`find "${cachePath}" -maxdepth 1 -type d`, {
            encoding: "utf8",
          })
            .trim()
            .split("\n")
            .filter((dir) => dir !== cachePath); // Exclude the cache path itself

          for (const dir of topLevelDirs) {
            try {
              const sizeOutput = execSync(`du -sb "${dir}"`, {
                encoding: "utf8",
              }).trim();
              const size = parseInt(sizeOutput.split("\t")[0], 10);
              const sizeFormatted = execSync(`du -sh "${dir}"`, {
                encoding: "utf8",
              })
                .trim()
                .split("\t")[0];
              directorySizes.push({ path: dir, size, sizeFormatted });
            } catch (error) {
            }
          }
        } catch (error) {
          console.warn(`Could not analyze directory: ${cachePath}`);
        }
      }
    }

    const top5 = directorySizes
      .sort((a, b) => b.size - a.size)
      .slice(0, 5);

    console.log("\nTop 5 largest cache directories:");
    top5.forEach((dir, index) => {
      console.log(`${index + 1}. ${dir.sizeFormatted}\t${dir.path}`);
    });
    console.log("");
  }

  const preinstallEndTime = isAnalyze ? Date.now() : 0;
  writeFileSync(
    "/tmp/cache-status.json",
    JSON.stringify({ cacheHit, cacheKey: fullCacheKey, preinstallEndTime })
  );

  if (isAnalyze) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(
      `Preinstall completed in ${duration}s (cache ${cacheHit ? "hit" : "miss"})`
    );
  } else {
    console.log(`Preinstall completed (cache ${cacheHit ? "hit" : "miss"})`);
  }
}

handleCaching().catch((error) => {
  console.error("Error in preinstall caching:", error);
  process.exit(0);
});
