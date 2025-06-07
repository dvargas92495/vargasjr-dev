import { describe, it, expect, vi, beforeEach } from "vitest";

const mockConstructEvent = vi.fn();
const mockRetrieve = vi.fn();
const mockUpdate = vi.fn();
const {
  mockSelect,
  mockFrom,
  mockWhere,
  mockLimit,
  mockExecute,
  mockInsert,
  mockValues,
  mockReturning
} = vi.hoisted(() => ({
  mockSelect: vi.fn(),
  mockFrom: vi.fn(),
  mockWhere: vi.fn(),
  mockLimit: vi.fn(),
  mockExecute: vi.fn(),
  mockInsert: vi.fn(),
  mockValues: vi.fn(),
  mockReturning: vi.fn()
}));

vi.mock("stripe", () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      webhooks: {
        constructEvent: mockConstructEvent
      },
      subscriptions: {
        retrieve: mockRetrieve
      },
      checkout: {
        sessions: {
          retrieve: mockRetrieve,
          update: mockUpdate
        }
      }
    }))
  };
});

vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: vi.fn().mockImplementation(() => ({
    send: vi.fn()
  })),
  PutObjectCommand: vi.fn()
}));



vi.mock("drizzle-orm/vercel-postgres", () => ({
  drizzle: vi.fn(() => ({
    select: mockSelect,
    insert: mockInsert
  }))
}));

vi.mock("@vercel/postgres", () => ({
  sql: {}
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn()
}));


import { POST } from "../api/stripe/webhook/route";

const mockEnv = vi.hoisted(() => ({
  STRIPE_WEBHOOK_SECRET: "whsec_test_secret",
  STRIPE_SECRET_KEY: "sk_test_key"
}));

describe("Stripe Webhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConstructEvent.mockClear();
    mockRetrieve.mockClear();
    mockUpdate.mockClear();
    mockSelect.mockClear();
    mockFrom.mockClear();
    mockWhere.mockClear();
    mockLimit.mockClear();
    mockExecute.mockClear();
    mockInsert.mockClear();
    mockValues.mockClear();
    mockReturning.mockClear();
    process.env.STRIPE_WEBHOOK_SECRET = mockEnv.STRIPE_WEBHOOK_SECRET;
    process.env.STRIPE_SECRET_KEY = mockEnv.STRIPE_SECRET_KEY;
    
    mockUpdate.mockResolvedValue({});
    mockRetrieve.mockResolvedValue({
      items: {
        data: [{ price: { unit_amount: 15000000 } }]
      }
    });
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
      data: { 
        object: { 
          id: "cs_test_123",
          customer_details: { name: "John Doe" },
          subscription: "sub_test_123"
        } 
      }
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

  describe("handleVargasJrHired", () => {
    it("should process checkout.session.completed event with customer email", async () => {
      const mockEvent = {
        type: "checkout.session.completed",
        id: "evt_test_123",
        data: { object: { id: "cs_test_123" } }
      };

      const mockSession = {
        id: "cs_test_123",
        customer_email: "test@example.com",
        subscription: "sub_test_123"
      };

      const mockSubscription = {
        items: {
          data: [{ price: { unit_amount: 15000000 } }]
        }
      };

      mockConstructEvent.mockReturnValue(mockEvent as unknown as import("stripe").Stripe.Event);
      mockRetrieve.mockResolvedValueOnce(mockSession).mockResolvedValueOnce(mockSubscription);
      mockSelect.mockReturnValue({ from: mockFrom });
      mockFrom.mockReturnValue({ where: mockWhere });
      mockWhere.mockReturnValue({ limit: mockLimit });
      mockLimit.mockReturnValue({ execute: mockExecute });
      mockExecute.mockResolvedValueOnce([]);
      mockInsert.mockReturnValue({ values: mockValues });
      mockValues.mockReturnValue({ returning: mockReturning });
      mockReturning.mockReturnValue({ execute: mockExecute });
      mockExecute.mockResolvedValueOnce([{ id: 1, email: "test@example.com" }]);

      const request = new Request("http://localhost/webhook", {
        method: "POST",
        body: JSON.stringify(mockEvent),
        headers: { "stripe-signature": "valid_signature" }
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.received).toBe(true);
      expect(mockRetrieve).toHaveBeenCalledWith("cs_test_123", { expand: ['customer'] });
    });

    it("should handle missing customer email gracefully", async () => {
      const mockEvent = {
        type: "checkout.session.completed",
        id: "evt_test_789",
        data: { object: { id: "cs_test_789" } }
      };

      const mockSession = {
        id: "cs_test_789",
        customer_email: null
      };

      mockConstructEvent.mockReturnValue(mockEvent as unknown as import("stripe").Stripe.Event);
      mockRetrieve.mockResolvedValue(mockSession);

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
});
