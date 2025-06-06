import { NextResponse } from "next/server";
import Stripe from "stripe";
import { ContactsTable } from "@/db/schema";
import { drizzle } from "drizzle-orm/vercel-postgres";
import { sql } from "@vercel/postgres";
import { eq } from "drizzle-orm";
import { getEnvironmentPrefix, getBaseUrl } from "@/app/api/constants";
import { postSlackMessage } from "@/server";

export async function POST(request: Request) {
  try {
    const body = await request.text();
    const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    
    if (!stripeWebhookSecret) {
      console.error("STRIPE_WEBHOOK_SECRET environment variable is not set");
      return NextResponse.json(
        { error: "Stripe webhook configuration missing" },
        { status: 500 }
      );
    }

    const stripeSignature = request.headers.get("stripe-signature");
    
    if (!stripeSignature) {
      console.error("Missing stripe-signature header");
      return NextResponse.json(
        { error: "Missing stripe-signature header" },
        { status: 400 }
      );
    }

    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) {
      console.error("STRIPE_SECRET_KEY environment variable is not set");
      return NextResponse.json(
        { error: "Stripe configuration missing" },
        { status: 500 }
      );
    }

    const stripe = new Stripe(stripeSecretKey);
    
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, stripeSignature, stripeWebhookSecret);
    } catch (err) {
      console.error("Webhook signature verification failed:", err);
      return NextResponse.json(
        { error: "Webhook signature verification failed" },
        { status: 400 }
      );
    }

    console.log(`Received Stripe webhook event: ${event.type}`);

    switch (event.type) {
      case 'checkout.session.completed':
        await handleVargasJrHired(event);
        break;
      case 'checkout.session.expired':
        await handleCheckoutCanceled(event);
        break;
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Error processing Stripe webhook:", error);
    return NextResponse.json(
      { error: "Failed to process Stripe webhook" },
      { status: 500 }
    );
  }
}

async function handleVargasJrHired(event: Stripe.Event) {
  console.log("Processing checkout.session.completed event:", event.id);
  
  try {
    const session = event.data.object as Stripe.Checkout.Session;
    
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) {
      console.error("STRIPE_SECRET_KEY not available for session retrieval");
      return;
    }
    
    const stripe = new Stripe(stripeSecretKey);
    const fullSession = await stripe.checkout.sessions.retrieve(session.id, {
      expand: ['customer']
    });
    
    const customerEmail = fullSession.customer_email;
    if (!customerEmail) {
      console.error("No customer email found in checkout session");
      return;
    }
    
    const db = drizzle(sql);
    
    let contact = await db
      .select()
      .from(ContactsTable)
      .where(eq(ContactsTable.email, customerEmail))
      .limit(1)
      .execute();
    
    if (contact.length === 0) {
      const newContact = await db
        .insert(ContactsTable)
        .values({ email: customerEmail })
        .returning()
        .execute();
      contact = newContact;
    }
    
    const contactId = contact[0].id;
    const baseUrl = getBaseUrl();
    const environmentPrefix = getEnvironmentPrefix();
    const crmUrl = `${baseUrl}/admin/crm/${contactId}`;
    
    const prefix = environmentPrefix ? `${environmentPrefix}: ` : '';
    const message = `${prefix}🎉 New customer signed up!\n\nContact: ${customerEmail}\nView details: ${crmUrl}`;
    
    await postSlackMessage({
      channel: "#sales-alert",
      message: message,
    });
    
    console.log("Successfully posted Slack notification for checkout:", session.id);
    
  } catch (error) {
    console.error("Error handling checkout completion:", error);
  }
}

async function handleCheckoutCanceled(event: Stripe.Event) {
  console.log("Handling checkout canceled event:", event.id);
}
