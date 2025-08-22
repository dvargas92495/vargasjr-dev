import * as esbuild from "esbuild";
import { existsSync, mkdirSync } from "fs";

async function buildAgent() {
  console.log("🔨 Building VargasJR Agent...");

  if (!existsSync("dist")) {
    mkdirSync("dist", { recursive: true });
  }

  console.log("📦 Building browser service...");
  await esbuild.build({
    entryPoints: ["browser/src/index.ts"],
    bundle: true,
    platform: "node",
    target: "node18",
    outfile: "dist/browser.js",
    external: ["playwright"],
  });

  console.log("📦 Building worker service...");
  await esbuild.build({
    entryPoints: ["worker/index.ts"],
    bundle: true,
    platform: "node",
    target: "node18",
    outfile: "dist/worker.js",
    external: ["playwright"],
  });

  console.log("✅ Build complete! Artifacts in ./dist/");
}

buildAgent().catch(console.error);
