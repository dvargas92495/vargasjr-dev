import { InboxesTable, InboxMessagesTable, ContactsTable } from "@/db/schema";
import { NotFoundError } from "./errors";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/connection";

export const addInboxMessage = async ({
  body,
  source,
  inboxName,
  threadId,
  metadata,
}: {
  body: string;
  source: string;
  inboxName: string;
  threadId?: string;
  metadata?: Record<string, string>;
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
    .values({ source, body: body, inboxId: inbox[0].id, threadId, metadata });
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
      Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
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

export const upsertSlackContact = async (userId: string): Promise<string> => {
  const db = getDb();

  let contact = await db
    .select({ id: ContactsTable.id })
    .from(ContactsTable)
    .where(eq(ContactsTable.slackId, userId))
    .limit(1)
    .execute();

  if (contact.length) {
    return contact[0].id;
  }

  let displayName = userId; // fallback
  try {
    const response = await fetch(
      `https://slack.com/api/users.info?user=${userId}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
        },
      }
    );
    const data = (await response.json()) as any;
    if (data?.ok && data?.user) {
      displayName = data.user.display_name || data.user.real_name || userId;
    }
  } catch (error) {
    console.error("Failed to resolve Slack user:", error);
  }

  const newContact = await db
    .insert(ContactsTable)
    .values({
      slackId: userId,
      slackDisplayName: displayName,
      fullName: displayName,
    })
    .returning({ id: ContactsTable.id });

  return newContact[0].id;
};

export const resolveSlackChannel = async (
  channelId: string
): Promise<string> => {
  try {
    const response = await fetch(
      `https://slack.com/api/conversations.info?channel=${channelId}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
        },
      }
    );
    const data = (await response.json()) as any;
    if (data?.ok && data?.channel) {
      return `Slack (#${data.channel.name})`;
    }
  } catch (error) {
    console.error("Failed to resolve Slack channel:", error);
  }
  return `slack-${channelId}`;
};

export const convertPriorityToLabel = (
  priority: number
): "High" | "Medium" | "Low" => {
  if (priority >= 0.75) return "High";
  if (priority >= 0.4) return "Medium";
  return "Low";
};
