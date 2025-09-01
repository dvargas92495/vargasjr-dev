import { NextResponse } from "next/server";
import Stripe from "stripe";
import { generateContractorAgreementPDF } from "@/app/lib/pdf-generator";
import { uploadPDFToS3 } from "@/app/lib/s3-client";
import { ContactsTable } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getEnvironmentPrefix, getBaseUrl } from "@/app/api/constants";
import { postSlackMessage, shouldCreateContact } from "@/server";
import { getDb } from "@/db/connection";

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
      event = stripe.webhooks.constructEvent(
        body,
        stripeSignature,
        stripeWebhookSecret
      );
    } catch (err) {
      console.error("Webhook signature verification failed:", err);
      return NextResponse.json(
        { error: "Webhook signature verification failed" },
        { status: 400 }
      );
    }

    console.log(`Received Stripe webhook event: ${event.type}`);

    switch (event.type) {
      case "checkout.session.completed":
        try {
          await handleVargasJrHired(event);
        } catch (error) {
          console.error("Failed to process checkout session:", error);
          return NextResponse.json(
            { error: "Failed to process checkout session" },
            { status: 500 }
          );
        }
        break;
      case "checkout.session.expired":
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

async function getSubscriptionRate(
  stripe: Stripe,
  session: Stripe.Checkout.Session
): Promise<string> {
  if (!session.subscription) {
    throw new Error("No subscription found on checkout session");
  }

  const subscription = await stripe.subscriptions.retrieve(
    session.subscription as string
  );
  if (!subscription.items.data[0]?.price.unit_amount) {
    throw new Error("No pricing information found on subscription");
  }

  const amount = subscription.items.data[0].price.unit_amount / 100;
  return `$${amount.toLocaleString()} USD`;
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
      expand: ["customer"],
    });

    const customerEmail = fullSession.customer_email;
    if (!customerEmail) {
      console.error("No customer email found in checkout session");
      return;
    }

    const db = getDb();

    let contact = await db
      .select()
      .from(ContactsTable)
      .where(eq(ContactsTable.email, customerEmail))
      .limit(1)
      .execute();

    if (contact.length === 0) {
      const contactData = { email: customerEmail };

      if (!shouldCreateContact(contactData)) {
        console.log(
          "Skipping contact creation: no identifying information provided"
        );
        return;
      }

      const newContact = await db
        .insert(ContactsTable)
        .values(contactData)
        .returning()
        .execute();
      contact = newContact;
    }

    const contactId = contact[0].id;
    const baseUrl = getBaseUrl();
    const environmentPrefix = getEnvironmentPrefix();
    const crmUrl = `${baseUrl}/admin/crm/${contactId}`;

    const prefix = environmentPrefix ? `${environmentPrefix}: ` : "";
    const message = `${prefix}🎉 New customer signed up!\n\nContact: ${customerEmail}\nView details: ${crmUrl}`;

    await postSlackMessage({
      channel: "#sales-alert",
      message: message,
    });

    console.log(
      "Successfully posted Slack notification for checkout:",
      session.id
    );

    const rate = await getSubscriptionRate(stripe, fullSession);

    console.log("Generating contractor agreement PDF...");
    const pdfBuffer = await generateContractorAgreementPDF({
      contractorName: "Vargas JR",
      position: "Senior Software Developer",
      startDate: new Date().toLocaleDateString(),
      rate: rate,
      companyName: fullSession.customer_details?.name || "Client Company",
    });

    console.log("Uploading PDF to S3...");
    const contractPdfUuid = await uploadPDFToS3(pdfBuffer);
    console.log("PDF uploaded with UUID:", contractPdfUuid);

    console.log("Storing contract UUID in Stripe metadata...");
    await stripe.checkout.sessions.update(fullSession.id, {
      metadata: {
        contract_pdf_uuid: contractPdfUuid,
      },
    });

    console.log("Successfully processed hiring event for session:", session.id);
  } catch (error) {
    console.error("Error handling checkout completion:", error);
    throw error;
  }
}

async function handleCheckoutCanceled(event: Stripe.Event) {
  console.log("Handling checkout canceled event:", event.id);
}
