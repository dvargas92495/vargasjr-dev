import { execSync } from "child_process";
import { existsSync, mkdirSync } from "fs";

console.log("🔨 Building VargasJR Agent...");

if (!existsSync("dist")) {
  mkdirSync("dist", { recursive: true });
}

console.log("📦 Building browser service...");
execSync(
  "esbuild browser/src/index.ts --bundle --platform=node --target=node18 --outfile=dist/browser.js --external:playwright",
  { stdio: "inherit" }
);

console.log("📦 Building worker service...");
execSync(
  "esbuild worker/index.ts --bundle --platform=node --target=node18 --outfile=dist/worker.js --external:playwright",
  { stdio: "inherit" }
);

console.log("✅ Build complete! Artifacts in ./dist/");
