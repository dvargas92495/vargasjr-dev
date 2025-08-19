#!/usr/bin/env npx tsx

import { OneTimeMigrationRunner } from "./utils";
import { VargasJRSSHConnector } from "./ssh-connect";
import { AGENT_SERVER_PORT } from "../server/constants";

class CheckAgentServerStatusMigration extends OneTimeMigrationRunner {
  protected migrationName = "Check Agent Server Status";
  protected userAgent = "vargasjr-dev-agent-server-check";

  protected async runMigration(): Promise<void> {
    this.logSection("Agent Server Status Check");

    if (this.isPreviewMode) {
      this.logSuccess(
        "Preview mode: Would execute SSH commands to check agent server status"
      );
      await this.previewCommands();
      return;
    }

    await this.executeStatusCheck();
  }

  private async previewCommands(): Promise<void> {
    const commands = this.getStatusCheckCommands();

    let previewContent = "# Agent Server Status Check Preview\n\n";
    previewContent +=
      "The following SSH commands would be executed on the production instance:\n\n";

    commands.forEach((cmd, index) => {
      previewContent += `## Command ${index + 1}: ${cmd.description}\n`;
      previewContent += "```bash\n";
      previewContent += cmd.command + "\n";
      previewContent += "```\n\n";
    });

    previewContent +=
      "**Target Instance**: Production (tags: Name=vargas-jr, Type=main)\n";
    previewContent += `**Agent Server Port**: ${AGENT_SERVER_PORT}\n`;

    await this.postComment(previewContent);
  }

  private async executeStatusCheck(): Promise<void> {
    this.logSuccess("Connecting to production instance...");

    const commands = this.getStatusCheckCommands();
    let resultContent = "# Agent Server Status Check Results\n\n";
    resultContent += `**Timestamp**: ${new Date().toISOString()}\n`;
    resultContent += `**Agent Server Port**: ${AGENT_SERVER_PORT}\n\n`;

    for (const cmd of commands) {
      this.logSuccess(`Executing: ${cmd.description}`);

      try {
        const connector = new VargasJRSSHConnector({ command: cmd.command });
        await connector.connect();

        resultContent += `## ✅ ${cmd.description}\n`;
        resultContent += "```bash\n";
        resultContent += cmd.command + "\n";
        resultContent += "```\n";
        resultContent += "*Command executed successfully*\n\n";

        this.logSuccess(`Completed: ${cmd.description}`);
      } catch (error) {
        this.logError(`Failed to execute ${cmd.description}: ${error}`);

        resultContent += `## ❌ ${cmd.description}\n`;
        resultContent += "```bash\n";
        resultContent += cmd.command + "\n";
        resultContent += "```\n";
        resultContent += `**Error**: ${error}\n\n`;
      }
    }

    await this.postComment(resultContent);
    this.logSuccess("Agent server status check completed");
  }

  private getStatusCheckCommands() {
    return [
      {
        description: "Check Active Ports and Services",
        command: `echo "=== ACTIVE PORTS AND SERVICES ==="; netstat -tulpn 2>/dev/null || ss -tulpn 2>/dev/null || echo "No netstat/ss available"`,
      },
      {
        description: "Check Running Processes",
        command: `echo "=== RUNNING PROCESSES ==="; ps aux | head -20`,
      },
      {
        description: "Check Agent Server Port Specifically",
        command: `echo "=== AGENT SERVER PORT ${AGENT_SERVER_PORT} STATUS ==="; netstat -tulpn 2>/dev/null | grep :${AGENT_SERVER_PORT} || ss -tulpn 2>/dev/null | grep :${AGENT_SERVER_PORT} || echo "Port ${AGENT_SERVER_PORT} not found in active ports"`,
      },
      {
        description: "Check Agent-related Processes",
        command: `echo "=== AGENT-RELATED PROCESSES ==="; ps aux | grep -i agent | grep -v grep || echo "No agent processes found"`,
      },
      {
        description: "Check System Resource Usage",
        command: `echo "=== SYSTEM RESOURCES ==="; free -h && echo "--- CPU ---" && top -bn1 | head -5`,
      },
    ];
  }
}

async function main() {
  const args = process.argv.slice(2);
  const isPreviewMode = args.includes("--preview");

  const migration = new CheckAgentServerStatusMigration(isPreviewMode);
  await migration.run();
}

if (require.main === module) {
  main().catch(console.error);
}
