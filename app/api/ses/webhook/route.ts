import { NextResponse } from "next/server";
import { createHmac } from "node:crypto";
import { addInboxMessage, upsertEmailContact } from "@/server";
import { NotFoundError } from "@/server/errors";
import { InboxesTable } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/connection";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { AWS_S3_BUCKETS, OWN_EMAIL } from "@/app/lib/constants";
import { parseEmailBody } from "@/server/email-content-parser";

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

    const sender = sesNotification.mail.commonHeaders.from[0] || null;
    const subject = sesNotification.mail.commonHeaders.subject || "No Subject";
    const messageId = sesNotification.mail.messageId;

    if (!sender) {
      console.error("Missing sender in SES notification");
      return NextResponse.json(
        { error: "Missing sender information" },
        { status: 400 }
      );
    }

    const senderLower = sender.toLowerCase();
    const isOwnEmail = senderLower.includes(OWN_EMAIL.toLowerCase());

    if (isOwnEmail) {
      console.log(
        `Ignoring email from own address: ${sender} (messageId: ${messageId})`
      );
      return NextResponse.json({ received: true, ignored: true });
    }

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
        })
        .returning({ id: InboxesTable.id });
      inbox = newInbox;
    }

    let emailBody =
      "Email content not available - only headers provided by SES";
    const s3Key = `emails/${messageId}`;

    try {
      const s3Client = new S3Client({
        region: process.env.AWS_REGION || "us-east-1",
      });

      const getObjectCommand = new GetObjectCommand({
        Bucket: AWS_S3_BUCKETS.MEMORY,
        Key: s3Key,
      });

      const s3Response = await s3Client.send(getObjectCommand);
      if (s3Response.Body) {
        const rawEmailBody = await s3Response.Body.transformToString();
        emailBody = parseEmailBody(rawEmailBody);
      }
    } catch (error) {
      console.error("Failed to retrieve email body from S3:", error);
    }

    const contactId = await upsertEmailContact(sender);

    await addInboxMessage({
      body: emailBody,
      inboxName: "email",
      externalId: s3Key,
      metadata: metadata,
      contactId: contactId,
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
