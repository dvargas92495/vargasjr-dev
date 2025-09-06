import { NextResponse } from "next/server";
import { createHmac } from "node:crypto";
import { addInboxMessage, upsertEmailContact } from "@/server";
import { NotFoundError } from "@/server/errors";
import { InboxesTable } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/connection";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";

function parseEmailAddress(emailString: string): { email: string; fullName: string | null } {
  const trimmed = emailString.trim();
  
  const match = trimmed.match(/^(.+?)\s*<([^>]+)>$/);
  if (match) {
    const name = match[1].trim().replace(/^["']|["']$/g, '');
    const email = match[2].trim();
    return { email, fullName: name || null };
  }
  
  if (trimmed.includes('@') && !trimmed.includes('<')) {
    return { email: trimmed, fullName: null };
  }
  
  if (trimmed.includes('@')) {
    return { email: trimmed, fullName: null };
  }
  
  return { email: '', fullName: trimmed || null };
}

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

    let emailBody =
      "Email content not available - only headers provided by SES";

    try {
      const s3Client = new S3Client({
        region: process.env.AWS_REGION || "us-east-1",
      });
      const s3Key = `emails/${messageId}`;

      const getObjectCommand = new GetObjectCommand({
        Bucket: process.env.AWS_S3_INBOX_BUCKET || "vargasjr-inbox",
        Key: s3Key,
      });

      const s3Response = await s3Client.send(getObjectCommand);
      if (s3Response.Body) {
        emailBody = await s3Response.Body.transformToString();
      }
    } catch (error) {
      console.error("Failed to retrieve email body from S3:", error);
    }

    if (sender && sender !== "unknown") {
      await upsertEmailContact(sender);
    }

    const { email } = parseEmailAddress(sender && sender !== "unknown" ? sender : "unknown@unknown.com");
    await addInboxMessage({
      body: emailBody,
      source: email,
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
