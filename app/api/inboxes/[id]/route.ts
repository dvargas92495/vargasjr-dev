import { InboxesTable } from "@/db/schema";
import { z } from "zod";
import { InboxTypes } from "@/db/constants";
import { getDb } from "@/db/connection";
import { withApiWrapper } from "@/utils/api-wrapper";
import { eq } from "drizzle-orm";

const updateInboxSchema = z.object({
  name: z.string(),
  displayLabel: z.string().nullable().optional(),
  type: z.enum(InboxTypes),
});

async function getInboxHandler(body: unknown) {
  const { id } = z.object({ id: z.string() }).parse(body || {});
  const db = getDb();
  const [inbox] = await db
    .select()
    .from(InboxesTable)
    .where(eq(InboxesTable.id, id))
    .limit(1);

  if (!inbox) {
    throw new Error("Inbox not found");
  }

  return inbox;
}

async function updateInboxHandler(body: unknown) {
  const parsedBody = updateInboxSchema.extend({ id: z.string() }).parse(body);
  const { id, name, displayLabel, type } = parsedBody;

  const db = getDb();
  const [updatedInbox] = await db
    .update(InboxesTable)
    .set({
      name,
      displayLabel,
      type,
    })
    .where(eq(InboxesTable.id, id))
    .returning();

  if (!updatedInbox) {
    throw new Error("Inbox not found");
  }

  return updatedInbox;
}

export const GET = withApiWrapper(getInboxHandler);
export const PUT = withApiWrapper(updateInboxHandler);
