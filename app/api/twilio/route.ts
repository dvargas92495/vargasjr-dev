import { InboxesTable } from "@/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db/connection";
import { addInboxMessage, upsertEmailContact } from "@/server";
import { NextResponse } from "next/server";

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

export async function POST(request: Request) {
  const requestId = `twilio-webhook-${Date.now()}`;
  
  try {
    console.log("Twilio webhook received");

    const formData = await request.formData();
    const formObject: Record<string, string> = {};
    
    for (const [key, value] of formData.entries()) {
      formObject[key] = value.toString();
    }

    const { NumMedia, To, From, Body } = bodySchema.parse(formObject);

    const numMedia = parseInt(NumMedia);
    if (numMedia > 0) {
      throw new Error("Attachments not supported yet.");
    }

    const db = getDb();
    let inbox = await db
      .select({ id: InboxesTable.id })
      .from(InboxesTable)
      .where(eq(InboxesTable.name, `twilio-phone-${To}`))
      .limit(1)
      .execute();

    if (!inbox.length) {
      const newInbox = await db
        .insert(InboxesTable)
        .values({
          name: `twilio-phone-${To}`,
          type: "SMS",
          config: {},
        })
        .returning({ id: InboxesTable.id });
      inbox = newInbox;
    }

    const contactId = await upsertEmailContact(From);
    await addInboxMessage({
      body: Body,
      inboxName: `twilio-phone-${To}`,
      contactId: contactId,
    });

    console.log("Twilio webhook processed successfully");
    return NextResponse.json({
      Response: {},
    }, {
      headers: {
        "Content-Type": "text/xml",
      },
    });
  } catch (error) {
    console.error(`[${requestId}] Error processing Twilio webhook:`, error);
    return NextResponse.json(
      { error: "Failed to process Twilio webhook" },
      { status: 500 }
    );
  }
}
