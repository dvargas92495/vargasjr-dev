#!/usr/bin/env npx tsx

import { execSync } from "child_process";
import { existsSync, readdirSync, readFileSync } from "fs";
import { join } from "path";

interface KnowledgeFile {
  name: string;
  body: string;
  trigger_description: string;
  parent_folder_id?: string | null;
}

interface DevinKnowledge {
  id: string;
  name: string;
  body: string;
  trigger_description: string;
  parent_folder_id?: string | null;
  created_at: string;
}

interface DevinApiResponse {
  knowledge: DevinKnowledge[];
  folders: any[];
}

class KnowledgeRunner {
  private knowledgeDir: string;
  private isPreviewMode: boolean;

  constructor(isPreviewMode: boolean = false) {
    this.knowledgeDir = join(process.cwd(), "docs");
    this.isPreviewMode = isPreviewMode;
  }

  async runKnowledge(): Promise<void> {
    if (this.isPreviewMode) {
      console.log("🔍 Previewing knowledge changes...");
    } else {
      console.log("🚀 Applying knowledge changes...");
    }
    
    try {
      const currentKnowledge = await this.fetchCurrentKnowledge();
      const localKnowledge = this.loadLocalKnowledge();
      await this.generateKnowledgeDiff(currentKnowledge, localKnowledge);
      
      if (this.isPreviewMode) {
        console.log("✅ Knowledge preview completed successfully!");
      } else {
        console.log("✅ Knowledge changes applied successfully!");
      }
      
    } catch (error) {
      const action = this.isPreviewMode ? "preview" : "apply";
      console.error(`❌ Failed to ${action} knowledge changes: ${error}`);
      process.exit(1);
    }
  }

  private async fetchCurrentKnowledge(): Promise<DevinKnowledge[]> {
    console.log("=== Fetching current knowledge from Devin API ===");
    
    const devinApiToken = process.env.DEVIN_API_TOKEN;
    if (!devinApiToken) {
      throw new Error("DEVIN_API_TOKEN environment variable is required");
    }

    try {
      const response = await fetch("https://api.devin.ai/v1/knowledge", {
        headers: {
          "Authorization": `Bearer ${devinApiToken}`,
          "Content-Type": "application/json"
        }
      });

      if (!response.ok) {
        throw new Error(`Devin API call failed: ${response.status} - ${response.statusText}`);
      }

      const data: DevinApiResponse = await response.json();
      console.log(`Found ${data.knowledge.length} existing knowledge items`);
      return data.knowledge;
    } catch (error) {
      throw new Error(`Failed to fetch current knowledge: ${error}`);
    }
  }

  private loadLocalKnowledge(): KnowledgeFile[] {
    console.log("=== Loading local knowledge files ===");
    
    if (!existsSync(this.knowledgeDir)) {
      console.log("⚠️  No docs directory found - no local knowledge to process");
      return [];
    }

    const knowledgeFiles = readdirSync(this.knowledgeDir)
      .filter(file => file.endsWith('.json'))
      .sort();

    if (knowledgeFiles.length === 0) {
      console.log("⚠️  No JSON files found in docs directory");
      return [];
    }

    const localKnowledge: KnowledgeFile[] = [];
    
    for (const file of knowledgeFiles) {
      try {
        const filePath = join(this.knowledgeDir, file);
        const content = readFileSync(filePath, 'utf-8');
        const knowledge: KnowledgeFile = JSON.parse(content);
        
        this.validateKnowledgeFile(knowledge, file);
        localKnowledge.push(knowledge);
        console.log(`✓ Loaded knowledge: ${knowledge.name}`);
      } catch (error) {
        throw new Error(`Failed to load knowledge file ${file}: ${error}`);
      }
    }

    console.log(`Loaded ${localKnowledge.length} local knowledge items`);
    return localKnowledge;
  }

  private validateKnowledgeFile(knowledge: KnowledgeFile, filename: string): void {
    const required = ['name', 'body', 'trigger_description'];
    for (const field of required) {
      if (!knowledge[field as keyof KnowledgeFile]) {
        throw new Error(`Knowledge file ${filename} missing required field: ${field}`);
      }
    }
  }

  private async generateKnowledgeDiff(currentKnowledge: DevinKnowledge[], localKnowledge: KnowledgeFile[]): Promise<void> {
    console.log("=== Generating knowledge diff ===");
    
    const toCreate: KnowledgeFile[] = [];
    const toUpdate: { local: KnowledgeFile; current: DevinKnowledge }[] = [];
    const toDelete: DevinKnowledge[] = [];

    for (const local of localKnowledge) {
      const existing = currentKnowledge.find(k => k.name === local.name);
      if (!existing) {
        toCreate.push(local);
      } else if (this.hasChanges(local, existing)) {
        toUpdate.push({ local, current: existing });
      }
    }

    for (const current of currentKnowledge) {
      const stillExists = localKnowledge.find(k => k.name === current.name);
      if (!stillExists) {
        toDelete.push(current);
      }
    }

    await this.displayKnowledgeChanges(toCreate, toUpdate, toDelete);
    
    if (!this.isPreviewMode) {
      await this.applyChanges(toCreate, toUpdate, toDelete);
    }
  }

  private hasChanges(local: KnowledgeFile, current: DevinKnowledge): boolean {
    return (
      local.body !== current.body ||
      local.trigger_description !== current.trigger_description ||
      local.parent_folder_id !== current.parent_folder_id
    );
  }

  private async displayKnowledgeChanges(
    toCreate: KnowledgeFile[],
    toUpdate: { local: KnowledgeFile; current: DevinKnowledge }[],
    toDelete: DevinKnowledge[]
  ): Promise<void> {
    console.log("=== Knowledge changes summary ===");
    
    if (toCreate.length === 0 && toUpdate.length === 0 && toDelete.length === 0) {
      console.log("⚠️  No knowledge changes detected - all knowledge is up to date");
      return;
    }

    if (toCreate.length > 0) {
      console.log(`\n📝 Knowledge to CREATE (${toCreate.length}):`);
      for (const knowledge of toCreate) {
        console.log(`  + ${knowledge.name}`);
        console.log(`    Trigger: ${knowledge.trigger_description}`);
        console.log(`    Body: ${knowledge.body.substring(0, 100)}${knowledge.body.length > 100 ? '...' : ''}`);
      }
    }

    if (toUpdate.length > 0) {
      console.log(`\n✏️  Knowledge to UPDATE (${toUpdate.length}):`);
      for (const { local, current } of toUpdate) {
        console.log(`  ~ ${local.name}`);
        if (local.body !== current.body) {
          console.log(`    Body changed: ${current.body.substring(0, 50)}... → ${local.body.substring(0, 50)}...`);
        }
        if (local.trigger_description !== current.trigger_description) {
          console.log(`    Trigger changed: ${current.trigger_description} → ${local.trigger_description}`);
        }
      }
    }

    if (toDelete.length > 0) {
      console.log(`\n🗑️  Knowledge to DELETE (${toDelete.length}):`);
      for (const knowledge of toDelete) {
        console.log(`  - ${knowledge.name}`);
        console.log(`    ID: ${knowledge.id}`);
      }
    }

    console.log("\n=== End of knowledge changes ===");
    if (this.isPreviewMode) {
      console.log("⚠️  NOTE: These changes were NOT applied to Devin");
      console.log("This is a preview-only run for pull request review");
    } else {
      console.log("✅ These changes will be applied to Devin");
    }
  }

  private async applyChanges(
    toCreate: KnowledgeFile[],
    toUpdate: { local: KnowledgeFile; current: DevinKnowledge }[],
    toDelete: DevinKnowledge[]
  ): Promise<void> {
    const devinApiToken = process.env.DEVIN_API_TOKEN;
    if (!devinApiToken) {
      throw new Error("DEVIN_API_TOKEN environment variable is required");
    }

    console.log("=== Applying knowledge changes ===");

    for (const knowledge of toCreate) {
      console.log(`Creating knowledge: ${knowledge.name}`);
      const response = await fetch("https://api.devin.ai/v1/knowledge", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${devinApiToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(knowledge)
      });

      if (!response.ok) {
        throw new Error(`Failed to create knowledge ${knowledge.name}: ${response.status} - ${response.statusText}`);
      }
    }

    for (const { local, current } of toUpdate) {
      console.log(`Updating knowledge: ${local.name}`);
      const response = await fetch(`https://api.devin.ai/v1/knowledge/${current.id}`, {
        method: "PUT",
        headers: {
          "Authorization": `Bearer ${devinApiToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(local)
      });

      if (!response.ok) {
        throw new Error(`Failed to update knowledge ${local.name}: ${response.status} - ${response.statusText}`);
      }
    }

    for (const knowledge of toDelete) {
      console.log(`Deleting knowledge: ${knowledge.name}`);
      const response = await fetch(`https://api.devin.ai/v1/knowledge/${knowledge.id}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${devinApiToken}`,
          "Content-Type": "application/json"
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to delete knowledge ${knowledge.name}: ${response.status} - ${response.statusText}`);
      }
    }

    console.log("✅ All knowledge changes applied successfully");
  }
}

async function main() {
  const args = process.argv.slice(2);
  const isPreviewMode = args.includes('--preview');
  
  const runner = new KnowledgeRunner(isPreviewMode);
  await runner.runKnowledge();
}

if (require.main === module) {
  main().catch(console.error);
}
