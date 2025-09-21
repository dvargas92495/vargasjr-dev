import { InboxesTable, InboxMessagesTable, ContactsTable } from "@/db/schema";
import {
  NotFoundError,
  InvalidContactDataError,
  InvalidContactFormatError,
} from "./errors";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/connection";

export { InvalidContactDataError };

function parseEmailAddress(emailString: string): {
  email: string;
  fullName: string | null;
} {
  const trimmed = emailString.trim();

  const match = trimmed.match(/^(.+?)\s*<([^>]+)>$/);
  if (match) {
    const name = match[1].trim().replace(/^["']|["']$/g, "");
    const email = match[2].trim();
    return { email, fullName: name || null };
  }

  if (trimmed.includes("@") && !trimmed.includes("<")) {
    return { email: trimmed, fullName: null };
  }

  if (trimmed.includes("@")) {
    return { email: trimmed, fullName: null };
  }

  throw new InvalidContactFormatError(`Invalid email format: ${emailString}`);
}

function parsePhoneNumber(phoneString: string): {
  phoneNumber: string;
} {
  const trimmed = phoneString.trim();

  if (trimmed.startsWith("+") && /^\+\d+$/.test(trimmed)) {
    return { phoneNumber: trimmed };
  }

  throw new InvalidContactFormatError(
    `Invalid phone number format: ${phoneString}`
  );
}

export const upsertEmailContact = async (
  senderString: string
): Promise<string> => {
  const db = getDb();
  const { email, fullName } = parseEmailAddress(senderString);

  let contact = await db
    .select({ id: ContactsTable.id })
    .from(ContactsTable)
    .where(eq(ContactsTable.email, email))
    .limit(1)
    .execute();

  if (contact.length) {
    return contact[0].id;
  }

  const contactData = {
    email,
    fullName,
  };

  const newContact = await createContactWithValidation(contactData);
  return newContact.id;
};

export const upsertPhoneContact = async (
  senderString: string
): Promise<string> => {
  const db = getDb();
  const { phoneNumber } = parsePhoneNumber(senderString);

  let contact = await db
    .select({ id: ContactsTable.id })
    .from(ContactsTable)
    .where(eq(ContactsTable.phoneNumber, phoneNumber))
    .limit(1)
    .execute();

  if (contact.length) {
    return contact[0].id;
  }

  const contactData = {
    phoneNumber,
  };

  const newContact = await createContactWithValidation(contactData);
  return newContact.id;
};

export const addInboxMessage = async ({
  body,
  inboxName,
  threadId,
  externalId,
  createdAt,
  metadata,
  contactId,
}: {
  body: string;
  inboxName: string;
  threadId?: string;
  externalId?: string;
  createdAt?: Date;
  metadata?: Record<string, string>;
  contactId: string;
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

  await db.insert(InboxMessagesTable).values({
    body: body,
    inboxId: inbox[0].id,
    threadId,
    externalId,
    createdAt,
    metadata,
    contactId,
  });
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

  const contactData = {
    slackId: userId,
    slackDisplayName: displayName,
    fullName: displayName,
  };

  const newContact = await createContactWithValidation(contactData);
  return newContact.id;
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

export const shouldCreateContact = (contactData: {
  email?: string | null;
  phoneNumber?: string | null;
  fullName?: string | null;
  slackDisplayName?: string | null;
}): boolean => {
  const hasEmail = !!(contactData.email && contactData.email.trim() !== "");
  const hasPhone = !!(
    contactData.phoneNumber && contactData.phoneNumber.trim() !== ""
  );
  const hasName =
    !!(contactData.fullName && contactData.fullName.trim() !== "") ||
    !!(
      contactData.slackDisplayName && contactData.slackDisplayName.trim() !== ""
    );

  return hasEmail || hasPhone || hasName;
};

export const createContactWithValidation = async (contactData: {
  email?: string | null;
  phoneNumber?: string | null;
  fullName?: string | null;
  slackDisplayName?: string | null;
  slackId?: string | null;
}) => {
  if (!shouldCreateContact(contactData)) {
    throw new InvalidContactDataError();
  }

  const db = getDb();
  const newContact = await db
    .insert(ContactsTable)
    .values(contactData)
    .returning();

  return newContact[0];
};

export const convertPriorityToLabel = (
  priority: number
): "High" | "Medium" | "Low" => {
  if (priority >= 0.75) return "High";
  if (priority >= 0.4) return "Medium";
  return "Low";
};
