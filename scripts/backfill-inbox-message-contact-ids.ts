#!/usr/bin/env npx tsx

import { OneTimeMigrationRunner } from "./utils";
import { getDb } from "../db/connection";
import {
  InboxMessagesTable,
  ContactsTable,
  InboxMessageOperationsTable,
  OutboxMessagesTable,
} from "../db/schema";
import { eq, or, isNull } from "drizzle-orm";

class BackfillInboxMessageContactIds extends OneTimeMigrationRunner {
  protected migrationName = "Backfill Inbox Message Contact IDs";
  protected userAgent = "vargasjr-dev-backfill-contact-ids";

  protected async runMigration(): Promise<void> {
    const db = getDb();

    this.logSection("Starting Contact ID Backfill Migration");

    this.logSection("Querying messages without contact IDs");
    const messagesWithoutContactId = await db
      .select({
        id: InboxMessagesTable.id,
        source: InboxMessagesTable.source,
        inboxId: InboxMessagesTable.inboxId,
      })
      .from(InboxMessagesTable)
      .where(isNull(InboxMessagesTable.contactId));

    this.logSuccess(
      `Found ${messagesWithoutContactId.length} messages without contact IDs`
    );

    if (messagesWithoutContactId.length === 0) {
      this.logSuccess("No messages need contact ID backfill");
      return;
    }

    let matchedCount = 0;
    let deletedCount = 0;
    let errorCount = 0;

    this.logSection("Processing messages for contact matching");

    for (const message of messagesWithoutContactId) {
      try {
        const matchingContacts = await db
          .select({
            id: ContactsTable.id,
            email: ContactsTable.email,
            slackId: ContactsTable.slackId,
          })
          .from(ContactsTable)
          .where(
            or(
              eq(ContactsTable.email, message.source),
              eq(ContactsTable.slackId, message.source)
            )
          );

        if (matchingContacts.length === 1) {
          const contact = matchingContacts[0];

          if (!this.isPreviewMode) {
            await db
              .update(InboxMessagesTable)
              .set({ contactId: contact.id })
              .where(eq(InboxMessagesTable.id, message.id));
          }

          this.logSuccess(
            `${
              this.isPreviewMode ? "[PREVIEW] Would update" : "Updated"
            } message ${message.id} with contact ${contact.id} (source: ${
              message.source
            })`
          );
          matchedCount++;
        } else if (matchingContacts.length > 1) {
          this.logWarning(
            `Multiple contacts found for source "${message.source}" - skipping message ${message.id}`
          );
          errorCount++;
        } else {
          if (!this.isPreviewMode) {
            await db
              .delete(InboxMessageOperationsTable)
              .where(
                eq(InboxMessageOperationsTable.inboxMessageId, message.id)
              );

            await db
              .delete(OutboxMessagesTable)
              .where(eq(OutboxMessagesTable.parentInboxMessageId, message.id));

            await db
              .delete(InboxMessagesTable)
              .where(eq(InboxMessagesTable.id, message.id));
          }

          this.logWarning(
            `${
              this.isPreviewMode ? "[PREVIEW] Would delete" : "Deleted"
            } message ${message.id} - no matching contact for source: ${
              message.source
            }`
          );
          deletedCount++;
        }
      } catch (error) {
        this.logError(`Error processing message ${message.id}: ${error}`);
        errorCount++;
      }
    }

    this.logSection("Migration Summary");
    this.logSuccess(
      `Total messages processed: ${messagesWithoutContactId.length}`
    );
    this.logSuccess(`Messages matched and updated: ${matchedCount}`);
    this.logWarning(`Messages deleted (no contact found): ${deletedCount}`);
    if (errorCount > 0) {
      this.logError(`Messages with errors: ${errorCount}`);
    }

    if (this.isPreviewMode) {
      const previewSummary = `
## Contact ID Backfill Migration Preview

**Summary:**
- Total messages without contact IDs: ${messagesWithoutContactId.length}
- Messages that would be updated: ${matchedCount}
- Messages that would be deleted: ${deletedCount}
- Messages with errors/multiple matches: ${errorCount}

**Actions:**
- ✅ Update messages where source matches exactly one contact (email or slackId)
- ⚠️ Delete messages where no matching contact is found
- ⚠️ Skip messages with multiple potential contact matches

This migration will backfill the \`contactId\` field in \`InboxMessagesTable\` by matching the \`source\` field with contacts in \`ContactsTable\`. Messages that cannot be matched to any contact will be safely deleted along with their related records.
      `;

      await this.postComment(previewSummary);
    }

    this.logSuccess("Contact ID backfill migration completed successfully!");
  }
}

async function main() {
  const args = process.argv.slice(2);
  const isPreviewMode = args.includes("--preview");

  const migration = new BackfillInboxMessageContactIds(isPreviewMode);
  await migration.run();
}

if (require.main === module) {
  main().catch(console.error);
}
