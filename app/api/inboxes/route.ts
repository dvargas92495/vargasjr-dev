import { InboxesTable } from "@/db/schema";
import { z } from "zod";
import { InboxTypes } from "@/db/constants";
import { getDb } from "@/db/connection";
import { withApiWrapper } from "@/utils/api-wrapper";

const inboxSchema = z.object({
  name: z.string(),
  type: z.enum(InboxTypes),
});

async function createInboxHandler(body: unknown) {
  const { name, type } = inboxSchema.parse(body);

  const db = getDb();
  const [inbox] = await db
    .insert(InboxesTable)
    .values({ name, type })
    .returning({ id: InboxesTable.id });

  return { id: inbox.id };
}

export const POST = withApiWrapper(createInboxHandler);
