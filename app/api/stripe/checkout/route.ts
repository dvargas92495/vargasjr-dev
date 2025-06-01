import { NextResponse } from "next/server";
import Stripe from "stripe";

export async function POST() {
  try {
    console.log("Starting Stripe checkout session creation...");
    
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    console.log("Stripe secret key available:", !!stripeSecretKey);
    
    if (!stripeSecretKey) {
      console.error("STRIPE_SECRET_KEY environment variable is not set");
      return NextResponse.json(
        { error: "Stripe configuration missing" },
        { status: 500 }
      );
    }

    console.log("Initializing Stripe client...");
    const stripe = new Stripe(stripeSecretKey);

    console.log("Searching for product: Vargas JR Salary");
    const products = await stripe.products.search({
      query: 'name:"Vargas JR Salary"',
    });
    
    console.log("Products found:", products.data.length);
    console.log("Product data:", products.data.map(p => ({ id: p.id, name: p.name })));

    if (products.data.length === 0) {
      console.error("No products found with name 'Vargas JR Salary'");
      return NextResponse.json(
        { error: "Product not found" },
        { status: 404 }
      );
    }

    const product = products.data[0];
    console.log("Using product:", { id: product.id, name: product.name });
    
    console.log("Fetching prices for product:", product.id);
    const prices = await stripe.prices.list({
      product: product.id,
      active: true,
    });
    
    console.log("Active prices found:", prices.data.length);
    console.log("Price data:", prices.data.map(p => ({ id: p.id, amount: p.unit_amount, currency: p.currency })));

    if (prices.data.length === 0) {
      console.error("No active prices found for product:", product.id);
      return NextResponse.json(
        { error: "No active price found for product" },
        { status: 404 }
      );
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 
      (process.env.NODE_ENV === 'production' ? 'https://vargasjr.dev' : 'http://localhost:3000');
    console.log("Using base URL:", baseUrl);
    
    console.log("Creating checkout session...");
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price: prices.data[0].id,
          quantity: 1,
        },
      ],
      mode: "subscription",
      success_url: `${baseUrl}/thank-you`,
      cancel_url: baseUrl,
    });

    console.log("Checkout session created successfully:", session.id);
    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Failed to create checkout session:", error);
    console.error("Error details:", {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      type: error instanceof Error ? error.constructor.name : typeof error
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
