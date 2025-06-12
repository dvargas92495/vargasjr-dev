import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import Stripe from "stripe";
import { ChatSessionsTable, InboxesTable, ContactsTable } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/connection";
import { addInboxMessage } from "@/server";

export default async function ThankYou({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const checkoutSessionId = params.checkout_session_id as string;

  if (checkoutSessionId) {
    try {
      const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
      if (stripeSecretKey) {
        const stripe = new Stripe(stripeSecretKey);
        const session = await stripe.checkout.sessions.retrieve(checkoutSessionId);
        const customerEmail = session.customer_email;
        
        if (customerEmail) {
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
            const newContact = await db
              .insert(ContactsTable)
              .values({ email: customerEmail })
              .returning({ id: ContactsTable.id });
            contact = newContact;
          }

          const chatSession = await db
            .insert(ChatSessionsTable)
            .values({ 
              inboxId: inbox[0].id,
              contactId: contact[0].id
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

          redirect(`/chat/${chatSession[0].id}`);
        }
      }
    } catch (error) {
      console.error("Error processing checkout session:", error);
    }
  }
  return (
    <div className="grid place-items-center min-h-screen">
      <div className="text-center flex flex-col items-center gap-6">
        <div className="relative w-32 h-32 mb-4">
          <Image
            src="/avatar.webp"
            alt="Vargas JR Avatar"
            fill
            className="rounded-full border-4 border-primary shadow-lg"
          />
        </div>
        <h1 className="text-4xl font-bold mb-4">Thank You!</h1>
        <p>I&apos;ll be in touch with you soon.</p>
        <Link 
          href="/" 
          className="text-primary hover:underline hover:underline-offset-4"
        >
          ← Back to Home
        </Link>
      </div>
    </div>
  );
}    