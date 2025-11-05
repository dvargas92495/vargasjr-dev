#!/usr/bin/env tsx

import { execSync } from "child_process";
import {
  existsSync,
  writeFileSync,
  readFileSync,
  statSync,
  promises as fs,
} from "fs";
import { join, resolve, basename } from "path";
import { homedir } from "os";

type CleanupPattern = { baseDir: string; fileName: string };

function parseCleanupPattern(pattern: string): CleanupPattern | null {
  const parts = pattern.split("/**/");
  if (parts.length !== 2) return null;
  const [base, fileName] = parts;
  return { baseDir: resolve(process.cwd(), base), fileName };
}

async function removeFilesByName(
  baseDir: string,
  targetFileName: string
): Promise<number> {
  let removed = 0;
  const stack: string[] = [baseDir];

  while (stack.length > 0) {
    const dir = stack.pop()!;
    let entries;

    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);

      if (entry.isSymbolicLink()) continue;

      if (entry.name === targetFileName) {
        try {
          if (entry.isDirectory()) {
            await fs.rm(fullPath, { recursive: true, force: true });
          } else {
            await fs.unlink(fullPath);
          }
          removed++;
        } catch {}
        continue;
      }

      if (entry.isDirectory()) {
        stack.push(fullPath);
      }
    }
  }

  return removed;
}

async function fetchVercelEnvVars(
  target: "production" | "preview"
): Promise<Record<string, string>> {
  const vercelToken = process.env.VERCEL_TOKEN;

  if (!vercelToken) {
    console.log(
      `⚠️ VERCEL_TOKEN not found, skipping ${target} environment variable fetch`
    );
    return {};
  }

  try {
    const response = await fetch(
      `https://api.vercel.com/v3/env/pull/vargasjr-dev/${target}`,
      {
        headers: {
          Authorization: `Bearer ${vercelToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      throw new Error(
        `Vercel API error: ${response.status} ${response.statusText}`
      );
    }

    const data = await response.json();
    const envVars: Record<string, string> = {};
    console.log(Object.keys(data));

    Object.entries(data.env).forEach(([key, value]) => {
      if (
        !key.startsWith("VERCEL_") &&
        !key.startsWith("NEXT_") &&
        typeof value === "string"
      ) {
        envVars[key] = value;
        console.log("Pulled Env Var", key);
      }
    });

    return envVars;
  } catch (error) {
    console.warn(
      `Failed to fetch Vercel ${target} environment variables:`,
      error
    );
    return {};
  }
}

function writeEnvFile(envVars: Record<string, string>): void {
  if (Object.keys(envVars).length === 0) {
    console.log("ℹ️ No environment variables found or fetched");
    return;
  }

  const envFilePath = join(process.cwd(), ".env");
  let envContent = "";

  if (existsSync(envFilePath)) {
    envContent = readFileSync(envFilePath, "utf8");
  }

  Object.entries(envVars).forEach(([key, value]) => {
    const lines = envContent.split("\n");
    const existingLineIndex = lines.findIndex((line) =>
      line.startsWith(`${key}=`)
    );

    const formattedValue = value.includes("\n") ? `"${value}"` : value;

    if (existingLineIndex !== -1) {
      lines[existingLineIndex] = `${key}=${formattedValue}`;
      envContent = lines.join("\n");
    } else {
      const newLine = `${key}=${formattedValue}`;
      if (envContent && !envContent.endsWith("\n")) {
        envContent += "\n";
      }
      envContent += newLine + "\n";
    }
  });

  writeFileSync(envFilePath, envContent);
  console.log(
    `✅ Added ${Object.keys(envVars).length} environment variables to .env file`
  );
}

async function setup(): Promise<void> {
  const startTime = Date.now();

  if (!process.env.CI || process.env.VERCEL) {
    if (process.env.VERCEL) {
      console.log("Running in Vercel, using standard npm install");
    } else {
      console.log("Not in CI, using standard npm install");
    }
    execSync("npm install", { stdio: "inherit" });
    return;
  }

  console.log("\n=== Step 1: Restore cache from S3 ===");

  const isAnalyze = process.env.ANALYZE === "true";

  const {
    getFullCacheKey,
    downloadCacheFromS3,
    uploadCacheToS3,
    getCachePaths,
  } = await import("./cache-utils");

  const cacheKeyStartTime = isAnalyze ? Date.now() : 0;
  const fullCacheKey = getFullCacheKey();
  if (isAnalyze) {
    const cacheKeyDuration = ((Date.now() - cacheKeyStartTime) / 1000).toFixed(
      2
    );
    console.log(`Generated cache key: ${fullCacheKey} (${cacheKeyDuration}s)`);
  } else {
    console.log(`Generated cache key: ${fullCacheKey}`);
  }

  const cacheHit = await downloadCacheFromS3(fullCacheKey);

  if (isAnalyze && cacheHit) {
    console.log("\nAnalyzing cache directory sizes...");
    const cachePaths = getCachePaths();
    const directorySizes: {
      path: string;
      size: number;
      sizeFormatted: string;
    }[] = [];

    for (const cachePath of cachePaths) {
      if (existsSync(cachePath)) {
        try {
          const topLevelDirs = execSync(
            `find "${cachePath}" -maxdepth 1 -type d`,
            {
              encoding: "utf8",
            }
          )
            .trim()
            .split("\n")
            .filter((dir) => dir !== cachePath);

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
            } catch (error) {}
          }
        } catch (error) {
          console.warn(`Could not analyze directory: ${cachePath}`);
        }
      }
    }

    const top5 = directorySizes.sort((a, b) => b.size - a.size).slice(0, 5);

    console.log("\nTop 5 largest cache directories:");
    for (let index = 0; index < top5.length; index++) {
      const dir = top5[index];
      console.log(`${index + 1}. ${dir.sizeFormatted}\t${dir.path}`);

      try {
        const subItems = execSync(
          `find "${dir.path}" -maxdepth 1 -mindepth 1`,
          {
            encoding: "utf8",
          }
        )
          .trim()
          .split("\n")
          .filter((item) => item.length > 0);

        const subItemSizes: {
          path: string;
          size: number;
          sizeFormatted: string;
        }[] = [];

        for (const item of subItems) {
          try {
            const sizeOutput = execSync(`du -sb "${item}"`, {
              encoding: "utf8",
            }).trim();
            const size = parseInt(sizeOutput.split("\t")[0], 10);
            const sizeFormatted = execSync(`du -sh "${item}"`, {
              encoding: "utf8",
            })
              .trim()
              .split("\t")[0];
            subItemSizes.push({ path: item, size, sizeFormatted });
          } catch (error) {}
        }

        const top5SubItems = subItemSizes
          .sort((a, b) => b.size - a.size)
          .slice(0, 5);

        if (top5SubItems.length > 0) {
          console.log(`   Top 5 items within this directory:`);
          top5SubItems.forEach((subItem, subIndex) => {
            console.log(
              `   ${subIndex + 1}. ${subItem.sizeFormatted}\t${subItem.path}`
            );
          });
        }

        if (index === 0 && top5SubItems.length > 0) {
          try {
            const largestSubdir = top5SubItems.find((item) => {
              try {
                return (
                  existsSync(item.path) && statSync(item.path).isDirectory()
                );
              } catch {
                return false;
              }
            });

            if (largestSubdir) {
              console.log(
                `\n   Deeper Dive: largest subdirectory is ${largestSubdir.path} (${largestSubdir.sizeFormatted})`
              );

              try {
                const fileCount = execSync(
                  `find "${largestSubdir.path}" -type f | wc -l`,
                  { encoding: "utf8" }
                ).trim();
                const dirCount = execSync(
                  `find "${largestSubdir.path}" -type d | wc -l`,
                  { encoding: "utf8" }
                ).trim();

                console.log(`   Statistics:`);
                console.log(`   - Total files: ${fileCount}`);
                console.log(`   - Total directories: ${dirCount}`);

                const maxDepth = execSync(
                  `find "${largestSubdir.path}" -type d -printf '%d\\n' | sort -rn | head -1`,
                  { encoding: "utf8" }
                ).trim();
                const baseDepth = execSync(
                  `find "${largestSubdir.path}" -maxdepth 0 -printf '%d\\n'`,
                  { encoding: "utf8" }
                ).trim();
                const relativeDepth = parseInt(maxDepth) - parseInt(baseDepth);
                console.log(
                  `   - Maximum nesting depth: ${relativeDepth} levels`
                );

                const extensionStats = execSync(
                  `find "${largestSubdir.path}" -type f -name '*.*' | sed 's/.*\\.//' | sort | uniq -c | sort -rn | head -5`,
                  { encoding: "utf8" }
                ).trim();

                if (extensionStats) {
                  console.log(`   - Top 5 file types by count:`);
                  extensionStats.split("\n").forEach((line) => {
                    const match = line.trim().match(/^(\d+)\s+(.+)$/);
                    if (match) {
                      console.log(`     ${match[2]}: ${match[1]} files`);
                    }
                  });
                }

                const totalSize = largestSubdir.size;
                const fileCountNum = parseInt(fileCount);
                if (fileCountNum > 0) {
                  const avgSize = totalSize / fileCountNum;
                  let avgSizeFormatted = "";
                  if (avgSize < 1024) {
                    avgSizeFormatted = `${avgSize.toFixed(0)} bytes`;
                  } else if (avgSize < 1024 * 1024) {
                    avgSizeFormatted = `${(avgSize / 1024).toFixed(1)} KB`;
                  } else if (avgSize < 1024 * 1024 * 1024) {
                    avgSizeFormatted = `${(avgSize / (1024 * 1024)).toFixed(
                      1
                    )} MB`;
                  } else {
                    avgSizeFormatted = `${(
                      avgSize /
                      (1024 * 1024 * 1024)
                    ).toFixed(1)} GB`;
                  }
                  console.log(`   - Average file size: ${avgSizeFormatted}`);
                }
              } catch (error) {
                console.warn(`   Could not gather additional statistics`);
              }

              const deepDiveSubItems = execSync(
                `find "${largestSubdir.path}" -maxdepth 1 -mindepth 1`,
                {
                  encoding: "utf8",
                }
              )
                .trim()
                .split("\n")
                .filter((item) => item.length > 0);

              const deepDiveSubItemSizes: {
                path: string;
                size: number;
                sizeFormatted: string;
              }[] = [];

              for (const item of deepDiveSubItems) {
                try {
                  const sizeOutput = execSync(`du -sb "${item}"`, {
                    encoding: "utf8",
                  }).trim();
                  const size = parseInt(sizeOutput.split("\t")[0], 10);
                  const sizeFormatted = execSync(`du -sh "${item}"`, {
                    encoding: "utf8",
                  })
                    .trim()
                    .split("\t")[0];
                  deepDiveSubItemSizes.push({
                    path: item,
                    size,
                    sizeFormatted,
                  });
                } catch (error) {}
              }

              const top5DeepDiveItems = deepDiveSubItemSizes
                .sort((a, b) => b.size - a.size)
                .slice(0, 5);

              if (top5DeepDiveItems.length > 0) {
                console.log(`   Top 5 items within largest subdirectory:`);
                top5DeepDiveItems.forEach((subItem, subIndex) => {
                  console.log(
                    `   ${subIndex + 1}. ${subItem.sizeFormatted}\t${
                      subItem.path
                    }`
                  );
                });
              }
            }
          } catch (error) {
            console.warn(`   Could not analyze largest subdirectory`);
          }
        }
      } catch (error) {
        console.warn(`   Could not analyze subdirectories of: ${dir.path}`);
      }
      console.log("");
    }
    console.log("");
  }

  const preinstallEndTime = isAnalyze ? Date.now() : 0;
  writeFileSync(
    "/tmp/cache-status.json",
    JSON.stringify({ cacheHit, cacheKey: fullCacheKey, preinstallEndTime })
  );

  if (isAnalyze) {
    const cacheDuration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(
      `Cache restoration completed in ${cacheDuration}s (cache ${
        cacheHit ? "hit" : "miss"
      })`
    );
  } else {
    console.log(
      `Cache restoration completed (cache ${cacheHit ? "hit" : "miss"})`
    );
  }

  console.log("\n=== Step 2: Install dependencies ===");
  if (cacheHit) {
    console.log(
      "✅ Cache hit detected (node_modules restored), skipping npm install"
    );
    console.log("Saving ~1 minute by skipping dependency installation");
  } else {
    console.log("Cache miss, running npm install...");
    execSync("npm install --ignore-scripts", { stdio: "inherit" });
  }

  console.log("\n=== Step 3: Post-install cleanup ===");
  console.log("🧹 Cleaning up unnecessary files from node_modules...");
  const cleanupGlobs = ["node_modules/**/.jsii"];

  for (const globPattern of cleanupGlobs) {
    const parsed = parseCleanupPattern(globPattern);
    if (!parsed) {
      console.warn(`  Could not parse pattern: ${globPattern}`);
      continue;
    }

    try {
      const count = await removeFilesByName(parsed.baseDir, parsed.fileName);
      if (count > 0) {
        console.log(
          `  Removed ${count} files/directories matching ${globPattern}`
        );
      }
    } catch (error) {
      console.warn(`  Could not clean up ${globPattern}:`, error);
    }
  }

  console.log("\n=== Step 4: Environment setup ===");

  const isMainBranch = process.env.GITHUB_REF === "refs/heads/main";
  const target = isMainBranch ? "production" : "preview";

  console.log(
    `🔧 Fetching Vercel ${target.toUpperCase()} environment variables...`
  );
  const envVars = await fetchVercelEnvVars(target);
  writeEnvFile(envVars);

  const playwrightCachePath = join(homedir(), ".cache", "ms-playwright");
  if (existsSync(playwrightCachePath)) {
    console.log("Playwright browsers already cached, skipping installation...");
  } else {
    console.log("Installing Chromium headless shell for CI environment...");
    execSync("npx playwright install chromium --with-deps --only-shell", {
      stdio: "inherit",
    });
  }

  const isMainPush =
    process.env.GITHUB_EVENT_NAME === "push" &&
    (process.env.GITHUB_REF === "refs/heads/main" ||
      process.env.GITHUB_REF_NAME === "main");
  const isLintJob = process.env.GITHUB_JOB === "lint";
  const shouldSaveCache = !cacheHit && isMainPush && isLintJob;

  if (shouldSaveCache) {
    console.log("\n=== Step 5: Save cache to S3 ===");
    console.log(`Saving cache (main branch, lint job, cache miss)`);
    await uploadCacheToS3(fullCacheKey);
  } else {
    console.log("\n=== Step 5: Cache save skipped ===");
    if (cacheHit) {
      console.log(`Reason: Cache hit (${fullCacheKey})`);
    } else if (!isMainPush) {
      console.log(
        `Reason: Not a push to main branch (event: ${process.env.GITHUB_EVENT_NAME}, ref: ${process.env.GITHUB_REF})`
      );
    } else if (!isLintJob) {
      console.log(`Reason: Not lint job (${process.env.GITHUB_JOB})`);
    }
  }

  const totalDuration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`\n✅ Setup completed in ${totalDuration}s`);
}

setup().catch((error) => {
  console.error("Error in setup:", error);
  process.exit(1);
});
