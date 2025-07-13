#!/usr/bin/env npx tsx

import { OneTimeMigrationRunner } from "./utils";
import { execSync } from "child_process";

class PR232Migration extends OneTimeMigrationRunner {
  protected migrationName = "PR 232 Health Check Migration";
  protected userAgent = "vargasjr-pr-232-migration";

  protected async runMigration(): Promise<void> {
    this.logSection("Connecting to PR 232 Instance");
    
    const commands = [
      "npm run healthcheck",
      "screen -ls", 
      "systemctl status amazon-ssm-agent",
      "sudo systemctl status amazon-ssm-agent"
    ];

    this.logSection("Executing Commands on PR 232");
    
    for (const command of commands) {
      this.logSection(`Running: ${command}`);
      
      try {
        const sshCommand = `npx tsx ./scripts/ssh-connect.ts --pr 232 --command "${command}"`;
        
        const output = execSync(sshCommand, { 
          encoding: 'utf8',
          stdio: 'pipe'
        });
        
        console.log(output);
        this.logSuccess(`Successfully executed: ${command}`);
      } catch (error: any) {
        this.logError(`Failed to execute '${command}': ${error.message}`);
        if (error.stdout) console.log(error.stdout);
        if (error.stderr) console.error(error.stderr);
      }
    }

    this.logSection("Migration Complete");
    this.logSuccess("All commands have been attempted on PR 232 instance");
  }
}

async function main() {
  const args = process.argv.slice(2);
  const isPreviewMode = args.includes('--preview');
  
  const migration = new PR232Migration(isPreviewMode);
  await migration.run();
}

if (require.main === module) {
  main().catch(console.error);
}
