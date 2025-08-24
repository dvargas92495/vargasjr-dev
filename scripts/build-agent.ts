import fs from "fs";
import path from "path";
import * as esbuild from "esbuild";
import { existsSync, mkdirSync } from "fs";
import { execSync } from "child_process";

async function buildAgent() {
  console.log("🔨 Building VargasJR Agent...");

  if (!existsSync("dist")) {
    mkdirSync("dist", { recursive: true });
  }

  console.log("📦 Building Agent...");
  await esbuild.build({
    entryPoints: ["worker/index.ts"],
    platform: "node",
    target: "node18",
    outfile: "dist/worker.js",
    bundle: true,
    external: ["playwright-core"],
  });

  execSync("mkdir -p dist/node_modules");
  execSync(
    "cp -r node_modules/playwright-core dist/node_modules/playwright-core"
  );

  console.log("✅ Agent Build complete! Artifacts in ./dist/");
}

buildAgent().catch(console.error);
