#!/usr/bin/env tsx

import { execSync } from "child_process";
import { existsSync, writeFileSync, readFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import * as cache from "@actions/cache";

interface VercelEnvVar {
  type: string;
  id: string;
  key: string;
  value: string;
  target: string[];
  gitBranch?: string;
  configurationId?: string;
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
      `https://api.vercel.com/v10/projects/vargasjr-dev/env?target=${target}`,
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

    data.envs?.forEach((envVar: VercelEnvVar) => {
      if (
        envVar.target.includes(target) &&
        !envVar.key.startsWith("VERCEL_") &&
        !envVar.key.startsWith("NEXT_")
      ) {
        envVars[envVar.key] = envVar.value;
        console.log("Pulled Env Var", envVar.key);
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

    if (process.env.CACHE_KEY && process.env.CACHE_PATHS) {
      try {
        console.log("Saving cache...");
        const cachePaths = process.env.CACHE_PATHS.split(",");
        const cacheId = await cache.saveCache(
          cachePaths,
          process.env.CACHE_KEY
        );
        console.log(`Cache saved with ID: ${cacheId}`);
      } catch (error) {
        console.warn("Cache save failed:", error);
      }
    }
  } else {
    if (process.env.VERCEL) {
      console.log(
        "Skipping Playwright browser installation (running in Vercel environment)"
      );
    } else {
      console.log(
        "Skipping Playwright browser installation (not in CI environment)"
      );
    }
  }
}

handlePostInstall().catch((error) => {
  console.error("Error in postinstall:", error);
  process.exit(0);
});
