import { InboxesTable, InboxMessagesTable } from "@/db/schema";
import { NotFoundError } from "./errors";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/connection";

export const addInboxMessage = async ({
  body,
  source,
  inboxName,
  threadId,
  createdAt,
}: {
  body: string;
  source: string;
  inboxName: string;
  threadId?: string;
  createdAt?: Date;
}) => {
  const db = getDb();
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
    .values({ source, body: body, inboxId: inbox[0].id, threadId, createdAt });
};

export const postSlackMessage = async ({
  channel,
  message,
}: {
  channel: string;
  message: string;
}) => {
  const response = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.SLACK_BOT_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      channel,
      text: message,
    }),
  });
  
  if (!response.ok) {
    throw new Error(`Slack API error: ${response.statusText}`);
  }
  
  return response.json();
};

export const convertPriorityToLabel = (priority: number): 'High' | 'Medium' | 'Low' => {
  if (priority >= 0.75) return 'High';
  if (priority >= 0.40) return 'Medium';
  return 'Low';
};
