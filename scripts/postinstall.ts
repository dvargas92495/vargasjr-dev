#!/usr/bin/env tsx

import { execSync } from "child_process";
import { existsSync, writeFileSync, readFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import * as cache from "@actions/cache";
import { getFullCacheKey, getCachePaths } from "./cache-utils";

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

    try {
      console.log("Saving cache...");
      const fullCacheKey = getFullCacheKey();
      const cachePaths = getCachePaths();
      const cacheId = await cache.saveCache(cachePaths, fullCacheKey);

      if (cacheId === -1) {
        console.error(`Cache save failed with ID: -1 for key: ${fullCacheKey}`);
      } else {
        console.log(`Cache saved with ID: ${cacheId} for key: ${fullCacheKey}`);
      }
    } catch (error) {
      const fullCacheKey = getFullCacheKey();
      console.error(`Cache save failed for key: ${fullCacheKey}`, error);
    }
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
