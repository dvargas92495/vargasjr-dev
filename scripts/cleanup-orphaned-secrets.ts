#!/usr/bin/env npx tsx

import { SecretsManager, ListSecretsCommand } from "@aws-sdk/client-secrets-manager";
import { OneTimeMigrationRunner, deleteSecret } from "./utils";
import { getGitHubAuthHeaders } from "../app/lib/github-auth";

interface SecretInfo {
  name: string;
  prNumber: string;
}

class OrphanedSecretsCleanup extends OneTimeMigrationRunner {
  protected migrationName = "Cleanup Orphaned PR Secrets";
  protected userAgent = "VargasJR-Cleanup-Orphaned-Secrets";
  private secretsManager: SecretsManager;
  private readonly region = "us-east-1";
  private readonly githubRepo = "dvargas92495/vargasjr-dev";

  constructor(isPreviewMode: boolean = false) {
    super(isPreviewMode);
    this.secretsManager = new SecretsManager({ region: this.region });
  }

  protected async runMigration(): Promise<void> {
    this.logSection("Fetching Open PRs");
    const openPRNumbers = await this.getOpenPRNumbers();
    this.logSuccess(`Found ${openPRNumbers.size} open PRs: ${Array.from(openPRNumbers).join(", ")}`);

    this.logSection("Listing Secrets from AWS Secrets Manager");
    const allSecrets = await this.listVargasJRSecrets();
    this.logSuccess(`Found ${allSecrets.length} VargasJR PR secrets`);

    this.logSection("Identifying Orphaned Secrets");
    const orphanedSecrets = this.identifyOrphanedSecrets(allSecrets, openPRNumbers);
    
    if (orphanedSecrets.length === 0) {
      this.logSuccess("No orphaned secrets found - all secrets correspond to open PRs");
      return;
    }

    this.logWarning(`Found ${orphanedSecrets.length} orphaned secrets:`);
    orphanedSecrets.forEach(secret => {
      console.log(`  - ${secret.name} (PR #${secret.prNumber})`);
    });

    if (this.isPreviewMode) {
      this.logSection("Preview Mode - Would Delete");
      orphanedSecrets.forEach(secret => {
        console.log(`  Would delete: ${secret.name}`);
      });
    } else {
      this.logSection("Deleting Orphaned Secrets");
      await this.deleteOrphanedSecrets(orphanedSecrets);
    }
  }

  private async getOpenPRNumbers(): Promise<Set<string>> {
    try {
      const headers = await getGitHubAuthHeaders();
      const response = await fetch(`https://api.github.com/repos/${this.githubRepo}/pulls?state=open`, {
        headers
      });
      
      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.statusText}`);
      }
      
      const prs = await response.json();
      return new Set(prs.map((pr: any) => pr.number.toString()));
    } catch (error) {
      this.logError(`Failed to fetch open PRs from GitHub: ${error}`);
      throw error;
    }
  }

  private async listVargasJRSecrets(): Promise<SecretInfo[]> {
    const secrets: SecretInfo[] = [];
    let nextToken: string | undefined;

    try {
      do {
        const command = new ListSecretsCommand({
          Filters: [
            {
              Key: "name",
              Values: ["vargasjr-pr-*-key-pem"]
            }
          ],
          NextToken: nextToken
        });

        const response = await this.secretsManager.send(command);
        
        if (response.SecretList) {
          for (const secret of response.SecretList) {
            if (secret.Name) {
              const prNumber = this.extractPRNumber(secret.Name);
              if (prNumber) {
                secrets.push({
                  name: secret.Name,
                  prNumber
                });
              }
            }
          }
        }

        nextToken = response.NextToken;
      } while (nextToken);

      return secrets;
    } catch (error) {
      this.logError(`Failed to list secrets from AWS Secrets Manager: ${error}`);
      throw error;
    }
  }

  private extractPRNumber(secretName: string): string | null {
    const match = secretName.match(/^vargasjr-pr-(\d+)-pr-\1-key-pem$/);
    return match ? match[1] : null;
  }

  private identifyOrphanedSecrets(allSecrets: SecretInfo[], openPRNumbers: Set<string>): SecretInfo[] {
    return allSecrets.filter(secret => !openPRNumbers.has(secret.prNumber));
  }

  private async deleteOrphanedSecrets(orphanedSecrets: SecretInfo[]): Promise<void> {
    for (const secret of orphanedSecrets) {
      try {
        await deleteSecret(secret.name, this.region);
        this.logSuccess(`Deleted secret: ${secret.name}`);
      } catch (error) {
        this.logError(`Failed to delete secret ${secret.name}: ${error}`);
        throw error;
      }
    }
    
    this.logSuccess(`Successfully deleted ${orphanedSecrets.length} orphaned secrets`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const isPreviewMode = args.includes('--preview');
  
  const cleanup = new OrphanedSecretsCleanup(isPreviewMode);
  await cleanup.run();
}

if (require.main === module) {
  main().catch(console.error);
}
