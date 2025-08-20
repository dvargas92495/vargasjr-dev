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
    this.logSuccess(
      "Starting agent server status check with troubleshooting..."
    );

    let resultContent = "# Agent Server Status Check Results\n\n";
    resultContent += `**Timestamp**: ${new Date().toISOString()}\n`;
    resultContent += `**Agent Server Port**: ${AGENT_SERVER_PORT}\n\n`;

    resultContent = await this.runTroubleshootingCommands(resultContent);

    const commands = this.getStatusCheckCommands();
    resultContent += "## SSH Status Check Commands\n\n";

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

  private async runTroubleshootingCommands(
    resultContent: string
  ): Promise<string> {
    resultContent += "## 🔍 Network Connectivity Troubleshooting\n\n";

    const troubleshootingCommands = this.getTroubleshootingCommands();

    for (const cmd of troubleshootingCommands) {
      this.logSuccess(`Running troubleshooting: ${cmd.description}`);

      try {
        if (cmd.isLocal) {
          const { exec } = await import("child_process");
          const { promisify } = await import("util");
          const execAsync = promisify(exec);

          const { stdout, stderr } = await execAsync(cmd.command);
          const output = stdout || stderr || "No output";

          resultContent += `### ✅ ${cmd.description}\n`;
          resultContent += "```bash\n";
          resultContent += cmd.command + "\n";
          resultContent += "```\n";
          resultContent += "**Output:**\n";
          resultContent += "```\n";
          resultContent += output.trim() + "\n";
          resultContent += "```\n\n";

          this.logSuccess(`Completed troubleshooting: ${cmd.description}`);
        } else {
          const connector = new VargasJRSSHConnector({ command: cmd.command });
          await connector.connect();

          resultContent += `### ✅ ${cmd.description}\n`;
          resultContent += "```bash\n";
          resultContent += cmd.command + "\n";
          resultContent += "```\n";
          resultContent += "*SSH command executed successfully*\n\n";

          this.logSuccess(`Completed troubleshooting: ${cmd.description}`);
        }
      } catch (error) {
        this.logError(
          `Troubleshooting failed for ${cmd.description}: ${error}`
        );

        resultContent += `### ❌ ${cmd.description}\n`;
        resultContent += "```bash\n";
        resultContent += cmd.command + "\n";
        resultContent += "```\n";
        resultContent += `**Error**: ${error}\n\n`;
      }
    }
    return resultContent;
  }

  private getTroubleshootingCommands() {
    return [
      {
        description: "Check Local Network Connectivity",
        command:
          "curl -s https://checkip.amazonaws.com/ && echo 'Local internet connectivity: OK'",
        isLocal: true,
      },
      {
        description: "Test DNS Resolution for Instance",
        command:
          "nslookup ec2-34-229-246-194.compute-1.amazonaws.com || echo 'DNS resolution failed'",
        isLocal: true,
      },
      {
        description: "Test Network Connectivity to Instance",
        command:
          "ping -c 3 34.229.246.194 || echo 'Ping failed - network unreachable'",
        isLocal: true,
      },
      {
        description: "Test SSH Port Connectivity",
        command:
          "timeout 10 bash -c '</dev/tcp/34.229.246.194/22' && echo 'SSH port 22 is reachable' || echo 'SSH port 22 is not reachable'",
        isLocal: true,
      },
      {
        description: "Check AWS CLI Connectivity",
        command:
          "aws sts get-caller-identity --output text --query 'Account' && echo 'AWS CLI connectivity: OK'",
        isLocal: true,
      },
      {
        description: "Verify Instance Status via AWS CLI",
        command:
          "aws ec2 describe-instances --instance-ids i-056de61cbeb4c46d4 --query 'Reservations[0].Instances[0].[State.Name,PublicIpAddress,SecurityGroups[0].GroupId]' --output text",
        isLocal: true,
      },
      {
        description: "Check Security Group Rules",
        command:
          "aws ec2 describe-security-groups --group-ids sg-0e88fc3206b3f3021 --query 'SecurityGroups[0].IpPermissions[?FromPort==`22`].[IpProtocol,FromPort,ToPort,IpRanges[0].CidrIp]' --output text",
        isLocal: true,
      },
      {
        description: "Test Basic SSH Connection (Quick Timeout)",
        command: "echo 'Testing basic SSH connectivity...'",
        isLocal: false,
      },
    ];
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
