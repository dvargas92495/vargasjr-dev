#!/usr/bin/env node

import { AgentRunner } from "./runner";
import { getVersion } from "./utils";
import { getLatestVersion, rebootAgent } from "./reboot-manager";

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
  } else if (command === "reboot") {
    const versionArg = args.find((arg) => arg.startsWith("--version="));
    const checkOnlyArg = args.includes("--check-only");

    if (checkOnlyArg) {
      const currentVersion = getVersion();
      console.log(`Current version: ${currentVersion}`);
      getLatestVersion().then((latestVersion) => {
        console.log(`Latest version: ${latestVersion || "unknown"}`);
        if (latestVersion && latestVersion !== currentVersion) {
          console.log("Update available");
        } else {
          console.log("No update needed");
        }
        process.exit(0);
      });
      return;
    }

    const targetVersion = versionArg ? versionArg.split("=")[1] : undefined;
    rebootAgent(targetVersion).then((success) => {
      process.exit(success ? 0 : 1);
    });
  } else {
    console.log("Usage: cli.ts [agent|reboot] [options]");
    process.exit(1);
  }
}

function reboot(): void {
  const args = process.argv.slice(2);
  const versionArg = args.find((arg) => arg.startsWith("--version="));
  const checkOnlyArg = args.includes("--check-only");

  if (checkOnlyArg) {
    const currentVersion = getVersion();
    console.log(`Current version: ${currentVersion}`);
    getLatestVersion().then((latestVersion) => {
      console.log(`Latest version: ${latestVersion || "unknown"}`);
      if (latestVersion && latestVersion !== currentVersion) {
        console.log("Update available");
      } else {
        console.log("No update needed");
      }
      process.exit(0);
    });
    return;
  }

  const targetVersion = versionArg ? versionArg.split("=")[1] : undefined;
  rebootAgent(targetVersion).then((success) => {
    process.exit(success ? 0 : 1);
  });
}

if (require.main === module) {
  main();
}

export { agent, main, reboot };
