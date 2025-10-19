#!/usr/bin/env tsx

import { execSync } from "child_process";
import { existsSync, writeFileSync, readFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";

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

    if (existingLineIndex !== -1) {
      lines[existingLineIndex] = `${key}=${value}`;
      envContent = lines.join("\n");
    } else {
      const newLine = `${key}=${value}`;
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

  const nodeModulesPath = join(process.cwd(), "node_modules");
  const needsBootstrap = !existsSync(nodeModulesPath);

  if (needsBootstrap) {
    console.log(
      "=== Bootstrap: Installing dependencies for first-time setup ==="
    );
    execSync("npm install --ignore-scripts", { stdio: "inherit" });
  }

  console.log("\n=== Step 1: Restore cache from S3 ===");

  const { getFullCacheKey, downloadCacheFromS3, uploadCacheToS3 } =
    await import("./cache-utils");

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

  const cacheDuration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(
    `Cache restoration completed in ${cacheDuration}s (cache ${
      cacheHit ? "hit" : "miss"
    })`
  );

  console.log("\n=== Step 2: Install dependencies ===");
  if (cacheHit && !needsBootstrap) {
    console.log(
      "✅ Cache hit detected (node_modules restored), skipping npm install"
    );
    console.log("Saving ~1 minute by skipping dependency installation");
  } else if (needsBootstrap) {
    console.log("✅ Dependencies already installed during bootstrap");
  } else {
    console.log("Cache miss, running npm install...");
    execSync("npm install --ignore-scripts", { stdio: "inherit" });
  }

  console.log("\n=== Step 3: Post-install setup ===");
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
    console.log("Installing Playwright browsers for CI environment...");
    execSync("npx playwright install --with-deps", { stdio: "inherit" });
  }

  if (!cacheHit) {
    console.log("\n=== Step 4: Save cache to S3 ===");
    await uploadCacheToS3(fullCacheKey);
  } else {
    console.log(
      `\nSkipping cache save (successful cache hit: ${fullCacheKey})`
    );
  }

  const totalDuration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`\n✅ Setup completed in ${totalDuration}s`);
}

setup().catch((error) => {
  console.error("Error in setup:", error);
  process.exit(1);
});
