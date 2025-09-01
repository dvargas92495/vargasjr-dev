import { NextResponse } from "next/server";
import { createHmac } from "node:crypto";
import { addInboxMessage } from "@/server";
import { NotFoundError } from "@/server/errors";
import { InboxesTable } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/connection";

interface SESMail {
  messageId: string;
  commonHeaders: {
    from: string[];
    subject: string;
    to: string[];
  };
}

interface SESReceipt {
  recipients: string[];
  timestamp: string;
}

interface SESNotification {
  mail: SESMail;
  receipt: SESReceipt;
}

interface SNSRecord {
  ses: SESNotification;
}

interface SNSEvent {
  Records: SNSRecord[];
}

export async function POST(request: Request) {
  try {
    const body = await request.text();
    const sesWebhookSecret = process.env.SES_WEBHOOK_SECRET;

    if (!sesWebhookSecret) {
      console.error("SES_WEBHOOK_SECRET environment variable is not set");
      return NextResponse.json(
        { error: "SES webhook configuration missing" },
        { status: 500 }
      );
    }

    const snsSignature = request.headers.get("x-amz-sns-message-signature");

    if (!snsSignature) {
      console.error("Missing x-amz-sns-message-signature header");
      return NextResponse.json(
        { error: "Missing SNS signature header" },
        { status: 400 }
      );
    }

    const hmac = createHmac("sha256", sesWebhookSecret);
    hmac.update(body);
    const expectedSignature = hmac.digest("base64");

    if (snsSignature !== expectedSignature) {
      console.error("SES webhook signature verification failed");
      return NextResponse.json(
        { error: "Webhook signature verification failed" },
        { status: 400 }
      );
    }

    const payload = JSON.parse(body) as SNSEvent;
    const sesNotification = payload.Records[0].ses;

    console.log(
      `Received SES webhook for message: ${sesNotification.mail.messageId}`
    );

    const sender = sesNotification.mail.commonHeaders.from[0] || "unknown";
    const subject = sesNotification.mail.commonHeaders.subject || "No Subject";
    const messageId = sesNotification.mail.messageId;

    const metadata = {
      subject: subject,
      messageId: messageId,
    };

    const db = getDb();
    let inbox = await db
      .select({ id: InboxesTable.id })
      .from(InboxesTable)
      .where(eq(InboxesTable.name, "email"))
      .limit(1)
      .execute();

    if (!inbox.length) {
      const newInbox = await db
        .insert(InboxesTable)
        .values({
          name: "email",
          type: "EMAIL",
          config: {},
        })
        .returning({ id: InboxesTable.id });
      inbox = newInbox;
    }

    await addInboxMessage({
      body: "Email content not available - only headers provided by SES",
      source: sender,
      inboxName: "email",
      metadata: metadata,
    });

    return NextResponse.json({ received: true });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    console.error("Error processing SES webhook:", error);
    return NextResponse.json(
      { error: "Failed to process SES webhook" },
      { status: 500 }
    );
  }
}
