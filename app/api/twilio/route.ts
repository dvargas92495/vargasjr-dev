import { InboxesTable } from "@/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db/connection";
import { addInboxMessage, upsertEmailContact } from "@/server";
import { withApiWrapper } from "@/utils/api-wrapper";

const bodySchema = z.object({
  ToCountry: z.string(),
  ToState: z.string(),
  SmsMessageSid: z.string(),
  NumMedia: z.string(),
  ToCity: z.string(),
  FromZip: z.string(),
  SmsSid: z.string(),
  FromState: z.string(),
  SmsStatus: z.string(),
  FromCity: z.string(),
  Body: z.string(),
  FromCountry: z.string(),
  To: z.string(),
  MessagingServiceSid: z.string(),
  ToZip: z.string(),
  NumSegments: z.string(),
  MessageSid: z.string(),
  AccountSid: z.string(),
  From: z.string(),
  ApiVersion: z.string(),
});

export const POST = withApiWrapper(async (body: unknown) => {
  console.log("Twilio webhook received");
  
  const { NumMedia, To, From, Body } = bodySchema.parse(body);

  const numMedia = parseInt(NumMedia);
  if (numMedia > 0) {
    throw new Error("Attachments not supported yet.");
  }

  const db = getDb();
  const inbox = await db
    .select({ id: InboxesTable.id })
    .from(InboxesTable)
    .where(eq(InboxesTable.name, `twilio-phone-${To}`))
    .limit(1)
    .execute();

  if (!inbox.length) {
    console.error("Inbox not found for phone number:", To);
    throw new Error("Inbox not found");
  }

  const contactId = await upsertEmailContact(From);
  await addInboxMessage({
    body: Body,
    inboxName: `twilio-phone-${To}`,
    contactId: contactId,
  });

  console.log("Twilio webhook processed successfully");
  return {
    headers: {
      "Content-Type": "text/xml",
    },
    Response: {},
  };
});
