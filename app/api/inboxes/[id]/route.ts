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
  config: z.record(z.any()).optional().default({}),
});

async function getInboxHandler(
  body: unknown,
  request: Request,
  context?: unknown
) {
  const params = await (context as { params: Promise<{ id: string }> }).params;
  const db = getDb();
  const [inbox] = await db
    .select()
    .from(InboxesTable)
    .where(eq(InboxesTable.id, params.id))
    .limit(1);

  if (!inbox) {
    throw new Error("Inbox not found");
  }

  return inbox;
}

async function updateInboxHandler(
  body: unknown,
  request: Request,
  context?: unknown
) {
  const params = await (context as { params: Promise<{ id: string }> }).params;
  const { name, displayLabel, type, config } = updateInboxSchema.parse(body);

  const db = getDb();
  const [updatedInbox] = await db
    .update(InboxesTable)
    .set({
      name,
      displayLabel,
      type,
      config,
    })
    .where(eq(InboxesTable.id, params.id))
    .returning();

  if (!updatedInbox) {
    throw new Error("Inbox not found");
  }

  return updatedInbox;
}

export const GET = withApiWrapper(getInboxHandler);
export const PUT = withApiWrapper(updateInboxHandler);
