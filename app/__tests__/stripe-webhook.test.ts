import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "../api/stripe/webhook/route";
import * as constants from "@/app/api/constants";
import * as server from "@/server";
import * as pdfGenerator from "@/app/lib/pdf-generator";
import * as s3Client from "@/app/lib/s3-client";

const {
  mockSelect,
  mockFrom,
  mockWhere,
  mockLimit,
  mockExecute,
  mockInsert,
  mockValues,
  mockReturning,
  mockConstructEvent,
  mockRetrieve,
  mockSubscriptionsRetrieve,
  mockPostSlackMessage,
  mockGetEnvironmentPrefix,
  mockGetBaseUrl
} = vi.hoisted(() => ({
  mockSelect: vi.fn(),
  mockFrom: vi.fn(),
  mockWhere: vi.fn(),
  mockLimit: vi.fn(),
  mockExecute: vi.fn(),
  mockInsert: vi.fn(),
  mockValues: vi.fn(),
  mockReturning: vi.fn(),
  mockConstructEvent: vi.fn(),
  mockRetrieve: vi.fn(),
  mockSubscriptionsRetrieve: vi.fn(),
  mockPostSlackMessage: vi.fn(),
  mockGetEnvironmentPrefix: vi.fn(),
  mockGetBaseUrl: vi.fn()
}));

vi.mock("stripe", () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      webhooks: {
        constructEvent: mockConstructEvent
      },
      checkout: {
        sessions: {
          retrieve: mockRetrieve,
          update: vi.fn()
        }
      },
      subscriptions: {
        retrieve: mockSubscriptionsRetrieve
      }
    }))
  };
});

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



const mockEnv = vi.hoisted(() => ({
  STRIPE_WEBHOOK_SECRET: "whsec_test_secret",
  STRIPE_SECRET_KEY: "sk_test_key",
  POSTGRES_URL: "postgresql://test:test@localhost:5432/test"
}));

vi.stubEnv("POSTGRES_URL", mockEnv.POSTGRES_URL);
vi.stubEnv("STRIPE_WEBHOOK_SECRET", mockEnv.STRIPE_WEBHOOK_SECRET);
vi.stubEnv("STRIPE_SECRET_KEY", mockEnv.STRIPE_SECRET_KEY);

describe("Stripe Webhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConstructEvent.mockClear();
    mockRetrieve.mockClear();
    mockSubscriptionsRetrieve.mockClear();
    mockSelect.mockClear();
    mockFrom.mockClear();
    mockWhere.mockClear();
    mockLimit.mockClear();
    mockExecute.mockClear();
    mockInsert.mockClear();
    mockValues.mockClear();
    mockReturning.mockClear();
    mockPostSlackMessage.mockClear();
    mockGetEnvironmentPrefix.mockClear();
    mockGetBaseUrl.mockClear();
    process.env.STRIPE_WEBHOOK_SECRET = mockEnv.STRIPE_WEBHOOK_SECRET;
    process.env.STRIPE_SECRET_KEY = mockEnv.STRIPE_SECRET_KEY;
    
    mockSubscriptionsRetrieve.mockResolvedValue({
      items: {
        data: [{
          price: {
            unit_amount: 500000
          }
        }]
      }
    });
    
    vi.spyOn(constants, 'getEnvironmentPrefix').mockImplementation(mockGetEnvironmentPrefix);
    vi.spyOn(constants, 'getBaseUrl').mockImplementation(mockGetBaseUrl);
    vi.spyOn(server, 'postSlackMessage').mockImplementation(mockPostSlackMessage);
    vi.spyOn(pdfGenerator, 'generateContractorAgreementPDF').mockResolvedValue(Buffer.from("mock pdf"));
    vi.spyOn(s3Client, 'uploadPDFToS3').mockResolvedValue("mock-uuid-123");
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

    const mockSession = {
      id: "cs_test_123",
      customer_email: "test@example.com",
      subscription: "sub_test_123"
    };

    mockConstructEvent.mockReturnValue(mockEvent as unknown as import("stripe").Stripe.Event);
    mockRetrieve.mockResolvedValue(mockSession);
    mockSelect.mockReturnValue({ from: mockFrom });
    mockFrom.mockReturnValue({ where: mockWhere });
    mockWhere.mockReturnValue({ limit: mockLimit });
    mockLimit.mockReturnValue({ execute: mockExecute });
    mockExecute.mockResolvedValue([{ id: 1, email: "test@example.com" }]);
    mockGetEnvironmentPrefix.mockReturnValue("");
    mockGetBaseUrl.mockReturnValue("https://vargasjr.dev");
    mockPostSlackMessage.mockResolvedValue({ ok: true });

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
    it("should create new contact and send Slack notification for new customer", async () => {
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

      mockConstructEvent.mockReturnValue(mockEvent as unknown as import("stripe").Stripe.Event);
      mockRetrieve.mockResolvedValue(mockSession);
      mockSelect.mockReturnValue({ from: mockFrom });
      mockFrom.mockReturnValue({ where: mockWhere });
      mockWhere.mockReturnValue({ limit: mockLimit });
      mockLimit.mockReturnValue({ execute: mockExecute });
      mockExecute.mockResolvedValueOnce([]);
      mockInsert.mockReturnValue({ values: mockValues });
      mockValues.mockReturnValue({ returning: mockReturning });
      mockReturning.mockReturnValue({ execute: mockExecute });
      mockExecute.mockResolvedValueOnce([{ id: 1, email: "test@example.com" }]);
      mockGetEnvironmentPrefix.mockReturnValue("DEV");
      mockGetBaseUrl.mockReturnValue("http://localhost:3000");
      mockPostSlackMessage.mockResolvedValue({ ok: true });

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
      expect(mockPostSlackMessage).toHaveBeenCalledWith({
        channel: "#sales-alert",
        message: "DEV: 🎉 New customer signed up!\n\nContact: test@example.com\nView details: http://localhost:3000/admin/crm/1"
      });
    });

    it("should find existing contact and send Slack notification", async () => {
      const mockEvent = {
        type: "checkout.session.completed",
        id: "evt_test_456",
        data: { object: { id: "cs_test_456" } }
      };

      const mockSession = {
        id: "cs_test_456",
        customer_email: "existing@example.com",
        subscription: "sub_test_456"
      };

      mockConstructEvent.mockReturnValue(mockEvent as unknown as import("stripe").Stripe.Event);
      mockRetrieve.mockResolvedValue(mockSession);
      mockSelect.mockReturnValue({ from: mockFrom });
      mockFrom.mockReturnValue({ where: mockWhere });
      mockWhere.mockReturnValue({ limit: mockLimit });
      mockLimit.mockReturnValue({ execute: mockExecute });
      mockExecute.mockResolvedValue([{ id: 2, email: "existing@example.com" }]);
      mockGetEnvironmentPrefix.mockReturnValue("");
      mockGetBaseUrl.mockReturnValue("https://vargasjr.dev");
      mockPostSlackMessage.mockResolvedValue({ ok: true });

      const request = new Request("http://localhost/webhook", {
        method: "POST",
        body: JSON.stringify(mockEvent),
        headers: { "stripe-signature": "valid_signature" }
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.received).toBe(true);
      expect(mockInsert).not.toHaveBeenCalled();
      expect(mockPostSlackMessage).toHaveBeenCalledWith({
        channel: "#sales-alert",
        message: "🎉 New customer signed up!\n\nContact: existing@example.com\nView details: https://vargasjr.dev/admin/crm/2"
      });
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
      expect(mockPostSlackMessage).not.toHaveBeenCalled();
    });

    it("should handle Slack API failure gracefully", async () => {
      const mockEvent = {
        type: "checkout.session.completed",
        id: "evt_test_error",
        data: { object: { id: "cs_test_error" } }
      };

      const mockSession = {
        id: "cs_test_error",
        customer_email: "error@example.com",
        subscription: "sub_test_error"
      };

      mockConstructEvent.mockReturnValue(mockEvent as unknown as import("stripe").Stripe.Event);
      mockRetrieve.mockResolvedValue(mockSession);
      mockSelect.mockReturnValue({ from: mockFrom });
      mockFrom.mockReturnValue({ where: mockWhere });
      mockWhere.mockReturnValue({ limit: mockLimit });
      mockLimit.mockReturnValue({ execute: mockExecute });
      mockExecute.mockResolvedValue([{ id: 3, email: "error@example.com" }]);
      mockGetEnvironmentPrefix.mockReturnValue("PREVIEW");
      mockGetBaseUrl.mockReturnValue("https://preview.vargasjr.dev");
      mockPostSlackMessage.mockRejectedValue(new Error("Slack API error"));

      const request = new Request("http://localhost/webhook", {
        method: "POST",
        body: JSON.stringify(mockEvent),
        headers: { "stripe-signature": "valid_signature" }
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Failed to process checkout session");
    });

    it("should handle different environment prefixes correctly", async () => {
      const testCases = [
        { env: "DEV", expected: "DEV: " },
        { env: "PREVIEW", expected: "PREVIEW: " },
        { env: "", expected: "" }
      ];

      for (const testCase of testCases) {
        const mockEvent = {
          type: "checkout.session.completed",
          id: `evt_test_${testCase.env}`,
          data: { object: { id: `cs_test_${testCase.env}` } }
        };

        const mockSession = {
          id: `cs_test_${testCase.env}`,
          customer_email: `${testCase.env.toLowerCase()}@example.com`,
          subscription: `sub_test_${testCase.env}`
        };

        mockConstructEvent.mockReturnValue(mockEvent as unknown as import("stripe").Stripe.Event);
        mockRetrieve.mockResolvedValue(mockSession);
        mockSelect.mockReturnValue({ from: mockFrom });
        mockFrom.mockReturnValue({ where: mockWhere });
        mockWhere.mockReturnValue({ limit: mockLimit });
        mockLimit.mockReturnValue({ execute: mockExecute });
        mockExecute.mockResolvedValue([{ id: 4, email: `${testCase.env.toLowerCase()}@example.com` }]);
        mockGetEnvironmentPrefix.mockReturnValue(testCase.env);
        mockGetBaseUrl.mockReturnValue("https://test.com");
        mockPostSlackMessage.mockResolvedValue({ ok: true });

        const request = new Request("http://localhost/webhook", {
          method: "POST",
          body: JSON.stringify(mockEvent),
          headers: { "stripe-signature": "valid_signature" }
        });

        await POST(request);

        expect(mockPostSlackMessage).toHaveBeenCalledWith({
          channel: "#sales-alert",
          message: `${testCase.expected}🎉 New customer signed up!\n\nContact: ${testCase.env.toLowerCase()}@example.com\nView details: https://test.com/admin/crm/4`
        });

        vi.clearAllMocks();
      }
    });
  });
});
