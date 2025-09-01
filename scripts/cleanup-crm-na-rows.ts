#!/usr/bin/env npx tsx

import { eq, and } from "drizzle-orm";
import { getDb } from "../db/connection";
import { ContactsTable } from "../db/schema";
import { OneTimeMigrationRunner } from "./utils";

class CleanupCrmNaRowsMigration extends OneTimeMigrationRunner {
  protected migrationName = "Cleanup CRM N/A Rows Migration";
  protected userAgent = "vargasjr-dev-cleanup-crm-na-rows";

  protected async runMigration(): Promise<void> {
    this.logSection("Starting CRM N/A rows cleanup");
    
    const db = getDb();
    
    const rowsToDelete = await db
      .select()
      .from(ContactsTable)
      .where(
        and(
          eq(ContactsTable.fullName, 'N/A'),
          eq(ContactsTable.email, 'N/A')
        )
      );

    const rowCount = rowsToDelete.length;
    
    if (rowCount === 0) {
      this.logSuccess("No rows found with both fullName='N/A' and email='N/A'");
      return;
    }

    this.logSection(`Found ${rowCount} rows to delete`);
    
    if (this.isPreviewMode) {
      this.logWarning(`PREVIEW MODE: Would delete ${rowCount} rows from ContactsTable where both fullName='N/A' and email='N/A'`);
      await this.postComment(
        `🔍 **CRM Cleanup Preview**\n\nWould delete **${rowCount} rows** from ContactsTable where both fullName='N/A' and email='N/A'.\n\nThese are the invalid contact entries that will be removed when this migration runs.`
      );
    } else {
      const result = await db
        .delete(ContactsTable)
        .where(
          and(
            eq(ContactsTable.fullName, 'N/A'),
            eq(ContactsTable.email, 'N/A')
          )
        );

      this.logSuccess(`Successfully deleted ${rowCount} rows from ContactsTable`);
    }
  }
}

async function main() {
  const args = process.argv.slice(2);
  const isPreviewMode = args.includes("--preview");
  
  const migration = new CleanupCrmNaRowsMigration(isPreviewMode);
  await migration.run();
}

if (require.main === module) {
  main().catch(console.error);
}
