import { drizzle } from "drizzle-orm/vercel-postgres";
import { sql } from "@vercel/postgres";
import { InboxesTable, InboxMessagesTable } from "@/db/schema";
import { NotFoundError } from "./errors";
import { eq } from "drizzle-orm";
const db = drizzle(sql);

export const addInboxMessage = async ({
  body,
  source,
  inboxName,
  createdAt,
}: {
  body: string;
  source: string;
  inboxName: string;
  createdAt?: Date;
}) => {
  const inbox = await db
    .select({ id: InboxesTable.id })
    .from(InboxesTable)
    .where(eq(InboxesTable.name, inboxName))
    .limit(1)
    .execute();

  if (!inbox.length) {
    throw new NotFoundError("Inbox not found");
  }

  await db
    .insert(InboxMessagesTable)
    .values({ source, body: body, inboxId: inbox[0].id, createdAt });
};
