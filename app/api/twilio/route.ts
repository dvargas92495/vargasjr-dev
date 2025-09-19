import { NextResponse } from "next/server";
import { InboxesTable } from "@/db/schema";
import { eq } from "drizzle-orm";
import { z, ZodError } from "zod";
import { getDb } from "@/db/connection";
import { addInboxMessage, upsertEmailContact } from "@/server";

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
  console.log("Twilio webhook received");

  try {
    const body = await request.json();
    console.log("Twilio request body:", JSON.stringify(body, null, 2));

    const { NumMedia, To, From, Body } = bodySchema.parse(body);
    console.log("Parsed Twilio data:", {
      NumMedia,
      To,
      From,
      Body: Body.substring(0, 100) + (Body.length > 100 ? "..." : ""),
    });

    const numMedia = parseInt(NumMedia);
    if (numMedia > 0) {
      console.log("Rejecting Twilio message with attachments:", numMedia);
      return NextResponse.json(
        { error: "Attachments not supported yet." },
        { status: 400 }
      );
    }

    console.log("Establishing database connection...");
    const db = getDb();
    console.log("Database connection established");

    console.log("Looking up inbox for phone number:", To);
    const inbox = await db
      .select({ id: InboxesTable.id })
      .from(InboxesTable)
      .where(eq(InboxesTable.name, `twilio-phone-${To}`))
      .limit(1)
      .execute();

    console.log("Inbox lookup result:", inbox);

    if (!inbox.length) {
      console.error("Inbox not found for phone number:", To);
      return NextResponse.json({ error: "Inbox not found" }, { status: 404 });
    }

    console.log("Creating/updating contact for:", From);
    const contactId = await upsertEmailContact(From);
    console.log("Contact ID resolved:", contactId);

    console.log("Adding inbox message...");
    await addInboxMessage({
      body: Body,
      inboxName: `twilio-phone-${To}`,
      contactId: contactId,
    });
    console.log("Inbox message added successfully");

    console.log("Twilio webhook processed successfully");
    return NextResponse.json({
      headers: {
        "Content-Type": "text/xml",
      },
      Response: {},
    });
  } catch (error) {
    console.error("Twilio webhook error:", error);
    console.error(
      "Error stack:",
      error instanceof Error ? error.stack : "No stack trace"
    );
    console.error("Error details:", {
      name: error instanceof Error ? error.name : "Unknown",
      message: error instanceof Error ? error.message : String(error),
      cause: error instanceof Error ? error.cause : undefined,
    });

    if (error instanceof ZodError) {
      console.error("Zod validation error details:", error.errors);
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
