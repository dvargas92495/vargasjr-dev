import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import Stripe from "stripe";
import { ChatSessionsTable, InboxesTable, ContactsTable } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/connection";
import { addInboxMessage, shouldCreateContact } from "@/server";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const sessionId = searchParams.get("checkout_session_id");

    if (!sessionId) {
      console.error("No checkout_session_id provided in success URL");
      return NextResponse.redirect(new URL("/thank-you", request.url));
    }

    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) {
      console.error("STRIPE_SECRET_KEY not available");
      return NextResponse.redirect(new URL("/thank-you", request.url));
    }

    const stripe = new Stripe(stripeSecretKey);

    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const customerEmail = session.customer_email;

    if (!customerEmail) {
      console.error("No customer email found in checkout session");
      return NextResponse.redirect(new URL("/thank-you", request.url));
    }

    const db = getDb();

    let inbox = await db
      .select({ id: InboxesTable.id })
      .from(InboxesTable)
      .where(eq(InboxesTable.type, "CHAT_SESSION"))
      .limit(1)
      .execute();

    if (!inbox.length) {
      const newInbox = await db
        .insert(InboxesTable)
        .values({
          name: "chat-sessions",
          type: "CHAT_SESSION",
          config: {},
        })
        .returning({ id: InboxesTable.id });
      inbox = newInbox;
    }

    let contact = await db
      .select({ id: ContactsTable.id })
      .from(ContactsTable)
      .where(eq(ContactsTable.email, customerEmail))
      .limit(1)
      .execute();

    if (!contact.length) {
      const contactData = { email: customerEmail };
      
      if (!shouldCreateContact(contactData)) {
        console.error("Cannot create contact: no identifying information provided");
        return NextResponse.redirect(new URL("/thank-you", request.url));
      }
      
      const newContact = await db
        .insert(ContactsTable)
        .values(contactData)
        .returning({ id: ContactsTable.id });
      contact = newContact;
    }

    const chatSession = await db
      .insert(ChatSessionsTable)
      .values({
        inboxId: inbox[0].id,
        contactId: contact[0].id,
      })
      .returning({ id: ChatSessionsTable.id });

    const initialMessage = `🎉 Welcome! I'm Vargas JR and I'm ready to work for you!

Here's how to get started:
• Enter your next task using the chat box below
• I can help with any software development needs
• Want to add me to your Slack workspace? [Learn how here](https://slack.com/help/articles/202035138-Add-apps-to-your-Slack-workspace)

What would you like me to work on first?`;

    await addInboxMessage({
      body: initialMessage,
      source: "Vargas JR",
      inboxName: "chat-sessions",
      threadId: chatSession[0].id,
    });

    return NextResponse.redirect(
      new URL(`/chat/${chatSession[0].id}`, request.url)
    );
  } catch (error) {
    console.error("Error in Stripe success handler:", error);
    return NextResponse.redirect(new URL("/thank-you", request.url));
  }
}
