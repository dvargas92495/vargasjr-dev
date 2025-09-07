import Stripe from "stripe";
import { getBaseUrl } from "@/app/api/constants";
import { withApiWrapper } from "@/utils/api-wrapper";

async function createCheckoutHandler() {
  console.log("Starting Stripe checkout session creation...");

  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  console.log("Stripe secret key available:", !!stripeSecretKey);

  if (!stripeSecretKey) {
    console.error("STRIPE_SECRET_KEY environment variable is not set");
    throw new Error("Stripe configuration missing");
  }

  console.log("Initializing Stripe client...");
  const stripe = new Stripe(stripeSecretKey);

  console.log("Searching for product: Vargas JR Salary");
  const products = await stripe.products.search({
    query: 'name:"Vargas JR Salary"',
  });

  console.log("Products found:", products.data.length);
  console.log(
    "Product data:",
    products.data.map((p) => ({ id: p.id, name: p.name }))
  );

  if (products.data.length === 0) {
    console.error("No products found with name 'Vargas JR Salary'");
    throw new Error("Product not found");
  }

  const product = products.data[0];
  console.log("Using product:", { id: product.id, name: product.name });

  console.log("Fetching prices for product:", product.id);
  const prices = await stripe.prices.list({
    product: product.id,
    active: true,
  });

  console.log("Active prices found:", prices.data.length);
  console.log(
    "Price data:",
    prices.data.map((p) => ({
      id: p.id,
      amount: p.unit_amount,
      currency: p.currency,
    }))
  );

  if (prices.data.length === 0) {
    console.error("No active prices found for product:", product.id);
    throw new Error("No active price found for product");
  }

  const baseUrl = getBaseUrl();
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
    success_url: `${baseUrl}/thank-you?checkout_session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: baseUrl,
  });

  console.log("Checkout session created successfully:", session.id);
  return { url: session.url };
}

export const POST = withApiWrapper(createCheckoutHandler);
