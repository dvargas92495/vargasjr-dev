import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "../api/stripe/webhook/route";

const mockConstructEvent = vi.fn();

vi.mock("stripe", () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      webhooks: {
        constructEvent: mockConstructEvent
      }
    }))
  };
});

const mockEnv = vi.hoisted(() => ({
  STRIPE_WEBHOOK_SECRET: "whsec_test_secret",
  STRIPE_SECRET_KEY: "sk_test_key"
}));

describe("Stripe Webhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConstructEvent.mockClear();
    process.env.STRIPE_WEBHOOK_SECRET = mockEnv.STRIPE_WEBHOOK_SECRET;
    process.env.STRIPE_SECRET_KEY = mockEnv.STRIPE_SECRET_KEY;
  });

  it("should return 500 when STRIPE_WEBHOOK_SECRET is missing", async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    
    const request = new Request("http://localhost/webhook", {
      method: "POST",
      body: JSON.stringify({ test: "data" }),
      headers: { "stripe-signature": "test_signature" }
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Stripe webhook configuration missing");
  });

  it("should return 500 when STRIPE_SECRET_KEY is missing", async () => {
    delete process.env.STRIPE_SECRET_KEY;
    
    const request = new Request("http://localhost/webhook", {
      method: "POST", 
      body: JSON.stringify({ test: "data" }),
      headers: { "stripe-signature": "test_signature" }
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Stripe configuration missing");
  });

  it("should return 400 when stripe-signature header is missing", async () => {
    const request = new Request("http://localhost/webhook", {
      method: "POST",
      body: JSON.stringify({ test: "data" })
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Missing stripe-signature header");
  });

  it("should return 400 when webhook signature verification fails", async () => {
    mockConstructEvent.mockImplementation(() => {
      throw new Error("Invalid signature");
    });

    const request = new Request("http://localhost/webhook", {
      method: "POST",
      body: JSON.stringify({ test: "data" }),
      headers: { "stripe-signature": "invalid_signature" }
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Webhook signature verification failed");
  });

  it("should successfully process checkout.session.completed event", async () => {
    const mockEvent = {
      type: "checkout.session.completed",
      id: "evt_test_123",
      data: { object: { id: "cs_test_123" } }
    };

    mockConstructEvent.mockReturnValue(mockEvent as unknown as import("stripe").Stripe.Event);

    const request = new Request("http://localhost/webhook", {
      method: "POST",
      body: JSON.stringify(mockEvent),
      headers: { "stripe-signature": "valid_signature" }
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.received).toBe(true);
    expect(mockConstructEvent).toHaveBeenCalledWith(
      JSON.stringify(mockEvent),
      "valid_signature", 
      "whsec_test_secret"
    );
  });

  it("should successfully process checkout.session.expired event", async () => {
    const mockEvent = {
      type: "checkout.session.expired",
      id: "evt_test_456", 
      data: { object: { id: "cs_test_456" } }
    };

    mockConstructEvent.mockReturnValue(mockEvent as unknown as import("stripe").Stripe.Event);

    const request = new Request("http://localhost/webhook", {
      method: "POST",
      body: JSON.stringify(mockEvent),
      headers: { "stripe-signature": "valid_signature" }
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.received).toBe(true);
  });

  it("should handle unhandled event types gracefully", async () => {
    const mockEvent = {
      type: "payment_intent.created",
      id: "evt_test_789",
      data: { object: { id: "pi_test_789" } }
    };

    mockConstructEvent.mockReturnValue(mockEvent as unknown as import("stripe").Stripe.Event);

    const request = new Request("http://localhost/webhook", {
      method: "POST", 
      body: JSON.stringify(mockEvent),
      headers: { "stripe-signature": "valid_signature" }
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.received).toBe(true);
  });
});
