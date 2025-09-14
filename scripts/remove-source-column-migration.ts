#!/usr/bin/env npx tsx

import { OneTimeMigrationRunner } from "./utils";
import { getDb } from "@/db/connection";
import { InboxMessagesTable, ContactsTable } from "@/db/schema";
import { eq, isNull, and, or } from "drizzle-orm";
import { upsertEmailContact, upsertSlackContact } from "@/server";

class RemoveSourceColumnMigration extends OneTimeMigrationRunner {
  protected migrationName = "Remove Source Column Migration";
  protected userAgent = "remove-source-column-migration";

  protected async runMigration(): Promise<void> {
    this.logSection("Starting source column removal migration");

    const db = getDb();

    this.logSection("Step 1: Finding messages with null contactId");
    const messagesWithNullContactId = await db
      .select({
        id: InboxMessagesTable.id,
        source: InboxMessagesTable.source,
      })
      .from(InboxMessagesTable)
      .where(isNull(InboxMessagesTable.contactId))
      .execute();

    this.logSuccess(
      `Found ${messagesWithNullContactId.length} messages with null contactId`
    );

    if (messagesWithNullContactId.length === 0) {
      this.logSuccess("No messages need contactId population");
    } else {
      this.logSection(
        "Step 2: Populating contactId for messages with null values"
      );

      let emailCount = 0;
      let slackCount = 0;
      let unknownCount = 0;

      for (const message of messagesWithNullContactId) {
        try {
          let contactId: string | null = null;

          if (message.source.includes("@")) {
            contactId = await upsertEmailContact(message.source);
            emailCount++;
          } else if (message.source.startsWith("U")) {
            contactId = await upsertSlackContact(message.source);
            slackCount++;
          } else {
            this.logWarning(`Unknown source format: ${message.source}`);
            unknownCount++;
            continue;
          }

          if (contactId) {
            await db
              .update(InboxMessagesTable)
              .set({ contactId })
              .where(eq(InboxMessagesTable.id, message.id))
              .execute();
          }
        } catch (error) {
          this.logError(`Failed to process message ${message.id}: ${error}`);
        }
      }

      this.logSuccess(`Updated ${emailCount} email contacts`);
      this.logSuccess(`Updated ${slackCount} slack contacts`);
      if (unknownCount > 0) {
        this.logWarning(`${unknownCount} messages had unknown source formats`);
      }
    }

    this.logSection("Step 3: Verifying all messages have contactId");
    const remainingNullContactIds = await db
      .select({ count: InboxMessagesTable.id })
      .from(InboxMessagesTable)
      .where(isNull(InboxMessagesTable.contactId))
      .execute();

    if (remainingNullContactIds.length > 0) {
      this.logError(
        `Still have ${remainingNullContactIds.length} messages with null contactId`
      );
      throw new Error(
        "Migration incomplete - some messages still have null contactId"
      );
    }

    this.logSuccess("All messages now have valid contactId values");

    if (this.isPreviewMode) {
      const previewContent = `
## Remove Source Column Migration Preview

This migration will prepare the database for removing the \`source\` column from \`InboxMessagesTable\`.

### Actions to be performed:
1. **Populate missing contactId values**: Found ${messagesWithNullContactId.length} messages with null contactId
2. **Create contacts for email sources**: Messages with email addresses in source field
3. **Create contacts for Slack sources**: Messages with Slack user IDs in source field
4. **Verify data integrity**: Ensure all messages have valid contactId before schema change

### Next steps after this migration:
- Update application code to remove source field usage
- Generate database migration to drop the source column
- Deploy updated application code

⚠️ **Important**: This is a one-time migration that must be run before deploying code changes that remove the source column.
`;

      await this.postComment(previewContent);
    }

    this.logSuccess("Migration completed successfully");
  }
}

async function main() {
  const args = process.argv.slice(2);
  const isPreviewMode = args.includes("--preview");

  const migration = new RemoveSourceColumnMigration(isPreviewMode);
  await migration.run();
}

if (require.main === module) {
  main().catch(console.error);
}
