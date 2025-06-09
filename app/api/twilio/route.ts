import { NextResponse } from "next/server";
import { InboxesTable, InboxMessagesTable } from "@/db/schema";
import { eq } from "drizzle-orm";
import { z, ZodError } from "zod";
import { db } from "@/db/connection";

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
  try {
    const body = await request.json();
    const { NumMedia, To, From, Body } = bodySchema.parse(body);

    const numMedia = parseInt(NumMedia);
    if (numMedia > 0) {
      return NextResponse.json(
        { error: "Attachments not supported yet." },
        { status: 400 }
      );
    }

    const inbox = await db
      .select({ id: InboxesTable.id })
      .from(InboxesTable)
      .where(eq(InboxesTable.name, `twilio-phone-${To}`))
      .limit(1)
      .execute();

    if (!inbox.length) {
      return NextResponse.json({ error: "Inbox not found" }, { status: 404 });
    }

    await db
      .insert(InboxMessagesTable)
      .values({ source: From, body: Body, inboxId: inbox[0].id });

    return NextResponse.json({
      headers: {
        "Content-Type": "text/xml",
      },
      Response: {},
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to process contact form" },
      { status: 500 }
    );
  }
}
