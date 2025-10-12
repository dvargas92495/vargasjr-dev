#!/usr/bin/env tsx

import { execSync } from "child_process";
import { existsSync, writeFileSync, readFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { getFullCacheKey, uploadCacheToS3 } from "./cache-utils";

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
      `https://api.vercel.com/v3/env/pull/vargasjr-dev/preview`,
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

async function handlePostInstall(): Promise<void> {
  const startTime = Date.now();

  if (process.env.CI && !process.env.VERCEL) {
    const isMainBranch = process.env.GITHUB_REF === "refs/heads/main";
    const target = isMainBranch ? "production" : "preview";

    console.log(
      `🔧 Fetching Vercel ${target.toUpperCase()} environment variables...`
    );
    const envVars = await fetchVercelEnvVars(target);
    writeEnvFile(envVars);

    const playwrightCachePath = join(homedir(), ".cache", "ms-playwright");

    if (existsSync(playwrightCachePath)) {
      console.log(
        "Playwright browsers already cached, skipping installation..."
      );
    } else {
      console.log("Installing Playwright browsers for CI environment...");
      execSync("npx playwright install --with-deps", { stdio: "inherit" });
    }

    let shouldSaveCache = true;
    try {
      const cacheStatusPath = "/tmp/cache-status.json";
      if (existsSync(cacheStatusPath)) {
        const cacheStatus = JSON.parse(readFileSync(cacheStatusPath, "utf8"));
        if (cacheStatus.cacheHit) {
          console.log(
            `Skipping cache save (successful cache hit: ${cacheStatus.cacheKey})`
          );
          shouldSaveCache = false;
        }
      }
    } catch (error) {
      console.warn("Could not read cache status, will save cache:", error);
    }

    if (shouldSaveCache) {
      console.log("Saving cache to S3...");
      const fullCacheKey = getFullCacheKey();
      await uploadCacheToS3(fullCacheKey);
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`Postinstall completed in ${duration}s`);
  } else if (process.env.VERCEL) {
    console.log(
      "Skipping Playwright browser installation (running in Vercel environment)"
    );
  } else {
    console.log(
      "Skipping Playwright browser installation (not in CI environment)"
    );
  }
}

handlePostInstall().catch((error) => {
  console.error("Error in postinstall:", error);
  process.exit(0);
});
