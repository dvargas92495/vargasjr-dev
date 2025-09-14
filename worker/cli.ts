#!/usr/bin/env node

import { AgentRunner } from "./runner";
import { getVersion } from "@/server/versioning";

function agent(): void {
  const agentRunner = new AgentRunner({ sleepTime: 5 });

  process.on("SIGINT", async () => {
    console.log("Received SIGINT, shutting down gracefully...");
    await agentRunner.stop();
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    console.log("Received SIGTERM, shutting down gracefully...");
    await agentRunner.stop();
    process.exit(0);
  });

  agentRunner.run();
}

function main(): void {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === "agent") {
    agent();
  } else {
    console.log("Usage: cli.ts [agent] [options]");
    process.exit(1);
  }
}

export { agent, main };
