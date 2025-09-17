#!/usr/bin/env npx tsx

import { VargasJRSSHConnector } from "./ssh-connect";
import * as dotenv from "dotenv";

interface DebugAgentConfig {
  branchName: string;
}

class VargasJRAgentDebugger {
  private config: DebugAgentConfig;
  private prNumber?: string;

  constructor(config: DebugAgentConfig) {
    this.config = config;
    this.prNumber = this.extractPRNumber(config.branchName);
  }

  private extractPRNumber(branchName: string): string | undefined {
    if (branchName === "main" || branchName === "refs/heads/main") {
      return undefined;
    }
    
    const prMatch = branchName.match(/(?:pr-(\d+)|\/(\d+)-)/);
    return prMatch ? (prMatch[1] || prMatch[2]) : undefined;
  }

  async debug(): Promise<void> {
    console.log(`🔍 Starting agent diagnostics for branch: ${this.config.branchName}`);
    
    const instanceType = this.prNumber ? `PR ${this.prNumber}` : "production";
    console.log(`🎯 Target: ${instanceType} agent instance`);

    try {
      await this.runComprehensiveDiagnostics();
      console.log(`✅ Agent diagnostics completed successfully`);
    } catch (error) {
      console.error(`❌ Agent diagnostics failed: ${error}`);
      throw error;
    }
  }

  private async runComprehensiveDiagnostics(): Promise<void> {
    console.log(`🚨 RUNNING COMPREHENSIVE AGENT DIAGNOSTICS`);
    console.log(`Instance Type: ${this.prNumber ? `Preview (PR ${this.prNumber})` : 'Production'}`);

    const serviceDiagnostics = [
      {
        name: "Service Status",
        command: "sudo systemctl status vargasjr-agent.service --no-pager -l",
      },
      {
        name: "Service Logs",
        command: "sudo journalctl -u vargasjr-agent.service --no-pager -l --since '5 minutes ago'",
      },
      {
        name: "Service Is-Active",
        command: "sudo systemctl is-active vargasjr-agent.service",
      },
      {
        name: "Service Is-Enabled", 
        command: "sudo systemctl is-enabled vargasjr-agent.service",
      },
      {
        name: "Check run_agent.sh exists",
        command: "ls -la /home/ubuntu/run_agent.sh",
      },
      {
        name: "Check .env exists",
        command: "ls -la /home/ubuntu/.env",
      },
    ];

    const comprehensiveDiagnostics = [
      {
        name: "System Logs",
        command: "sudo journalctl --since '10 minutes ago' --no-pager -l | tail -50",
      },
      {
        name: "Disk Space",
        command: "df -h",
      },
      {
        name: "Memory Usage", 
        command: "free -h",
      },
      {
        name: "Process List",
        command: "ps aux | grep -E '(agent|systemd)' | head -20",
      },
      {
        name: "Network Status",
        command: "ss -tuln | head -10",
      },
      {
        name: "Environment Check",
        command: "env | grep -E '(PATH|HOME|USER)'",
      },
      {
        name: "File Permissions",
        command: "ls -la /home/ubuntu/ | grep -E '(run_agent|env)'",
      },
      {
        name: "Systemd Failed Units",
        command: "sudo systemctl --failed --no-pager",
      },
    ];

    const healthDiagnostics = [
      {
        name: "Agent Health Check",
        command: "curl -s http://localhost:3001/health || echo 'Health endpoint not accessible'",
      },
      {
        name: "Recent Error Logs",
        command: "tail -50 /home/ubuntu/error.log 2>/dev/null || echo 'No error.log found'",
      },
      {
        name: "Recent Browser Error Logs", 
        command: "tail -20 /home/ubuntu/browser-error.log 2>/dev/null || echo 'No browser-error.log found'",
      },
      {
        name: "Recent Agent Logs",
        command: "tail -20 /home/ubuntu/agent.log 2>/dev/null || echo 'No agent.log found'",
      },
      {
        name: "Recent Output Logs",
        command: "tail -20 /home/ubuntu/out.log 2>/dev/null || echo 'No out.log found'",
      },
    ];

    const allDiagnostics = [
      ...serviceDiagnostics,
      ...comprehensiveDiagnostics, 
      ...healthDiagnostics
    ];

    console.log(`📋 Running ${allDiagnostics.length} diagnostic checks...`);

    for (const diagnostic of allDiagnostics) {
      try {
        console.log(`🔍 Running: ${diagnostic.name}`);
        
        const diagnosticConnector = new VargasJRSSHConnector({
          prNumber: this.prNumber,
          command: diagnostic.command
        });
        
        await diagnosticConnector.connect();
        console.log(`✅ Completed: ${diagnostic.name}`);
      } catch (error) {
        console.error(`⚠️ Failed: ${diagnostic.name} - ${error}`);
      }
    }

    console.log(`🚨 DIAGNOSTIC COMPLETE - All available diagnostic information has been collected`);
  }
}

async function main() {
  dotenv.config();
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error("Usage: npx tsx scripts/debug-agent.ts <branch-name>");
    console.error("Example: npx tsx scripts/debug-agent.ts main");
    console.error("Example: npx tsx scripts/debug-agent.ts pr-123");
    process.exit(1);
  }

  const branchName = args[0];
  const agentDebugger = new VargasJRAgentDebugger({ branchName });
  await agentDebugger.debug();
}

if (require.main === module) {
  main().catch(console.error);
}
