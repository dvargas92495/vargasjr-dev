#!/usr/bin/env node

import { spawn } from "child_process";
import LocalSetup from "./setup-local";

async function main() {
  console.log("🚀 Starting development server...\n");

  console.log("🔧 Running local setup...\n");
  try {
    const setup = new LocalSetup();
    await setup.run();
    console.log("\n✅ Local setup completed successfully!");
  } catch (error) {
    console.error("❌ Local setup failed:", error);
    process.exit(1);
  }

  console.log("\n🌟 Starting Next.js development server...\n");

  const nextProcess = spawn("npx", ["next", "dev", "--turbopack"], {
    stdio: "inherit",
    env: process.env,
  });

  process.on("SIGINT", () => {
    console.log("\n🛑 Shutting down development server...");
    nextProcess.kill("SIGINT");
    process.exit(0);
  });

  process.on("SIGTERM", () => {
    nextProcess.kill("SIGTERM");
    process.exit(0);
  });

  nextProcess.on("exit", (code) => {
    process.exit(code || 0);
  });
}

if (require.main === module) {
  main().catch((error) => {
    console.error("❌ Development server failed to start:", error);
    process.exit(1);
  });
}
