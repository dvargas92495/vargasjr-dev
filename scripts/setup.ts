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

    let totalUncompressedSize = 0;
    for (const cachePath of cachePaths) {
      if (existsSync(cachePath)) {
        try {
          const sizeOutput = execSync(`du -sb "${cachePath}"`, {
            encoding: "utf8",
          }).trim();
          totalUncompressedSize += parseInt(sizeOutput.split("\t")[0], 10);
        } catch (error) {}
      }
    }

    const totalUncompressedFormatted = execSync(
      `echo ${totalUncompressedSize} | awk '{printf "%.1fM", $1/1024/1024}'`,
      { encoding: "utf8" }
    ).trim();

    let compressedSize = 0;
    try {
      const tempFile = `/tmp/cache-size-test-${Date.now()}.tar.gz`;
      const relativePaths = cachePaths
        .filter((p) => existsSync(p))
        .map((p) => p.replace(homedir() + "/", ""));
      if (relativePaths.length > 0) {
        execSync(
          `tar -czf ${tempFile} -C ${homedir()} ${relativePaths.join(" ")}`,
          { stdio: "pipe" }
        );
        const compressedSizeOutput = execSync(`du -sb "${tempFile}"`, {
          encoding: "utf8",
        }).trim();
        compressedSize = parseInt(compressedSizeOutput.split("\t")[0], 10);
        execSync(`rm ${tempFile}`);
      }
    } catch (error) {}

    const compressedFormatted = execSync(
      `echo ${compressedSize} | awk '{printf "%.1fM", $1/1024/1024}'`,
      { encoding: "utf8" }
    ).trim();

    console.log(`\nTotal cache size:`);
    console.log(`  Uncompressed: ${totalUncompressedFormatted}`);
    console.log(`  Compressed:   ${compressedFormatted}`);
    console.log("");

    const MIN_SIZE_BYTES = 50 * 1024 * 1024;
    const MIN_DISPLAY_SIZE_BYTES = 1 * 1024 * 1024;

    interface DirectoryInfo {
      path: string;
      size: number;
      sizeFormatted: string;
    }

    function analyzeDirectory(dirPath: string, indent: string = ""): void {
      try {
        const items = execSync(`find "${dirPath}" -maxdepth 1 -mindepth 1`, {
          encoding: "utf8",
        })
          .trim()
          .split("\n")
          .filter((item) => item.length > 0);

        const itemSizes: DirectoryInfo[] = [];

        for (const item of items) {
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
            itemSizes.push({ path: item, size, sizeFormatted });
          } catch (error) {}
        }

        const sortedItems = itemSizes.sort((a, b) => b.size - a.size);

        for (const item of sortedItems) {
          if (item.size < MIN_DISPLAY_SIZE_BYTES) {
            continue;
          }

          console.log(`${indent}${item.sizeFormatted}\t${item.path}`);

          let isDir = false;
          try {
            isDir = statSync(item.path).isDirectory();
          } catch (error) {}

          if (isDir && item.size >= MIN_SIZE_BYTES) {
            analyzeDirectory(item.path, indent + "  ");
          }
        }
      } catch (error) {
        console.warn(`${indent}Could not analyze directory: ${dirPath}`);
      }
    }

    const topLevelDirs: DirectoryInfo[] = [];
    for (const cachePath of cachePaths) {
      if (existsSync(cachePath)) {
        try {
          const dirs = execSync(`find "${cachePath}" -maxdepth 1 -type d`, {
            encoding: "utf8",
          })
            .trim()
            .split("\n")
            .filter((dir) => dir !== cachePath);

          for (const dir of dirs) {
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
              topLevelDirs.push({ path: dir, size, sizeFormatted });
            } catch (error) {}
          }
        } catch (error) {
          console.warn(`Could not analyze directory: ${cachePath}`);
        }
      }
    }

    const sortedTopLevel = topLevelDirs.sort((a, b) => b.size - a.size);
    console.log("\nCache directories (sorted by size):");
    for (const dir of sortedTopLevel) {
      if (dir.size < MIN_DISPLAY_SIZE_BYTES) {
        continue;
      }

      console.log(`${dir.sizeFormatted}\t${dir.path}`);

      if (dir.size >= MIN_SIZE_BYTES) {
        analyzeDirectory(dir.path, "  ");
      }
      console.log("");
    }
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
  const cleanupGlobs = [
    "node_modules/**/.jsii",
    "node_modules/@cdktf/node-pty-prebuilt-multiarch/prebuilds/**/win32-x64",
    "node_modules/@next/**/swc-linux-x64-musl",
  ];

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
