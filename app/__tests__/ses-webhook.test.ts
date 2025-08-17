import { describe, it, expect, vi, beforeEach } from "vitest";
import { createHmac } from "node:crypto";
import { POST } from "../api/ses/webhook/route";

const {
  mockSelect,
  mockFrom,
  mockWhere,
  mockLimit,
  mockExecute,
  mockInsert,
  mockValues,
} = vi.hoisted(() => ({
  mockSelect: vi.fn(),
  mockFrom: vi.fn(),
  mockWhere: vi.fn(),
  mockLimit: vi.fn(),
  mockExecute: vi.fn(),
  mockInsert: vi.fn(),
  mockValues: vi.fn(),
}));

const mockEnv = vi.hoisted(() => ({
  SES_WEBHOOK_SECRET: "test_ses_webhook_secret",
}));

vi.mock("drizzle-orm/vercel-postgres", () => ({
  drizzle: vi.fn(() => ({
    select: mockSelect,
    insert: mockInsert,
  })),
}));

vi.mock("@vercel/postgres", () => ({
  sql: vi.fn(),
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
}));

describe("SES Webhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelect.mockClear();
    mockFrom.mockClear();
    mockWhere.mockClear();
    mockLimit.mockClear();
    mockExecute.mockClear();
    mockInsert.mockClear();
    mockValues.mockClear();
    process.env.SES_WEBHOOK_SECRET = mockEnv.SES_WEBHOOK_SECRET;
    process.env.POSTGRES_URL = "postgresql://test:test@localhost:5432/test";
  });

  it("should return 500 when SES_WEBHOOK_SECRET is missing", async () => {
    delete process.env.SES_WEBHOOK_SECRET;

    const request = new Request("http://localhost/webhook", {
      method: "POST",
      body: JSON.stringify({ test: "data" }),
      headers: { "x-amz-sns-message-signature": "test_signature" },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("SES webhook configuration missing");
  });

  it("should return 400 when x-amz-sns-message-signature header is missing", async () => {
    const request = new Request("http://localhost/webhook", {
      method: "POST",
      body: JSON.stringify({ test: "data" }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Missing SNS signature header");
  });

  it("should return 400 when webhook signature verification fails", async () => {
    const request = new Request("http://localhost/webhook", {
      method: "POST",
      body: JSON.stringify({ test: "data" }),
      headers: { "x-amz-sns-message-signature": "invalid_signature" },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Webhook signature verification failed");
  });

  it("should successfully process SES email notification", async () => {
    const mockPayload = {
      Records: [
        {
          ses: {
            mail: {
              messageId: "test-message-id-123",
              commonHeaders: {
                from: ["sender@example.com"],
                subject: "Test Email Subject",
                to: ["recipient@example.com"],
              },
            },
            receipt: {
              recipients: ["recipient@example.com"],
              timestamp: "2023-12-01T10:00:00.000Z",
            },
          },
        },
      ],
    };

    const body = JSON.stringify(mockPayload);
    const hmac = createHmac("sha256", mockEnv.SES_WEBHOOK_SECRET);
    hmac.update(body);
    const signature = hmac.digest("base64");

    const request = new Request("http://localhost/webhook", {
      method: "POST",
      body: body,
      headers: { "x-amz-sns-message-signature": signature },
    });

    mockSelect.mockReturnValue({ from: mockFrom });
    mockFrom.mockReturnValue({ where: mockWhere });
    mockWhere.mockReturnValue({ limit: mockLimit });
    mockLimit.mockReturnValue({ execute: mockExecute });
    mockExecute.mockResolvedValue([{ id: "inbox-id-123" }]);
    mockInsert.mockReturnValue({ values: mockValues });
    mockValues.mockResolvedValue(undefined);

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.received).toBe(true);
  });

  it("should handle missing sender gracefully", async () => {
    const mockPayload = {
      Records: [
        {
          ses: {
            mail: {
              messageId: "test-message-id-456",
              commonHeaders: {
                from: [],
                subject: "Test Email Subject",
                to: ["recipient@example.com"],
              },
            },
            receipt: {
              recipients: ["recipient@example.com"],
              timestamp: "2023-12-01T10:00:00.000Z",
            },
          },
        },
      ],
    };

    const body = JSON.stringify(mockPayload);
    const hmac = createHmac("sha256", mockEnv.SES_WEBHOOK_SECRET);
    hmac.update(body);
    const signature = hmac.digest("base64");

    const request = new Request("http://localhost/webhook", {
      method: "POST",
      body: body,
      headers: { "x-amz-sns-message-signature": signature },
    });

    mockSelect.mockReturnValue({ from: mockFrom });
    mockFrom.mockReturnValue({ where: mockWhere });
    mockWhere.mockReturnValue({ limit: mockLimit });
    mockLimit.mockReturnValue({ execute: mockExecute });
    mockExecute.mockResolvedValue([{ id: "inbox-id-456" }]);
    mockInsert.mockReturnValue({ values: mockValues });
    mockValues.mockResolvedValue(undefined);

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.received).toBe(true);
  });

  it("should handle missing subject gracefully", async () => {
    const mockPayload = {
      Records: [
        {
          ses: {
            mail: {
              messageId: "test-message-id-789",
              commonHeaders: {
                from: ["sender@example.com"],
                subject: undefined,
                to: ["recipient@example.com"],
              },
            },
            receipt: {
              recipients: ["recipient@example.com"],
              timestamp: "2023-12-01T10:00:00.000Z",
            },
          },
        },
      ],
    };

    const body = JSON.stringify(mockPayload);
    const hmac = createHmac("sha256", mockEnv.SES_WEBHOOK_SECRET);
    hmac.update(body);
    const signature = hmac.digest("base64");

    const request = new Request("http://localhost/webhook", {
      method: "POST",
      body: body,
      headers: { "x-amz-sns-message-signature": signature },
    });

    mockSelect.mockReturnValue({ from: mockFrom });
    mockFrom.mockReturnValue({ where: mockWhere });
    mockWhere.mockReturnValue({ limit: mockLimit });
    mockLimit.mockReturnValue({ execute: mockExecute });
    mockExecute.mockResolvedValue([{ id: "inbox-id-789" }]);
    mockInsert.mockReturnValue({ values: mockValues });
    mockValues.mockResolvedValue(undefined);

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.received).toBe(true);
  });

  it("should return 404 when inbox is not found", async () => {
    const mockPayload = {
      Records: [
        {
          ses: {
            mail: {
              messageId: "test-message-id-404",
              commonHeaders: {
                from: ["sender@example.com"],
                subject: "Test Email Subject",
                to: ["recipient@example.com"],
              },
            },
            receipt: {
              recipients: ["recipient@example.com"],
              timestamp: "2023-12-01T10:00:00.000Z",
            },
          },
        },
      ],
    };

    const body = JSON.stringify(mockPayload);
    const hmac = createHmac("sha256", mockEnv.SES_WEBHOOK_SECRET);
    hmac.update(body);
    const signature = hmac.digest("base64");

    const request = new Request("http://localhost/webhook", {
      method: "POST",
      body: body,
      headers: { "x-amz-sns-message-signature": signature },
    });

    mockSelect.mockReturnValue({ from: mockFrom });
    mockFrom.mockReturnValue({ where: mockWhere });
    mockWhere.mockReturnValue({ limit: mockLimit });
    mockLimit.mockReturnValue({ execute: mockExecute });
    mockExecute.mockResolvedValue([]);

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe("Inbox not found");
  });

  it("should return 500 for general errors", async () => {
    const mockPayload = {
      Records: [
        {
          ses: {
            mail: {
              messageId: "test-message-id-error",
              commonHeaders: {
                from: ["sender@example.com"],
                subject: "Test Email Subject",
                to: ["recipient@example.com"],
              },
            },
            receipt: {
              recipients: ["recipient@example.com"],
              timestamp: "2023-12-01T10:00:00.000Z",
            },
          },
        },
      ],
    };

    const body = JSON.stringify(mockPayload);
    const hmac = createHmac("sha256", mockEnv.SES_WEBHOOK_SECRET);
    hmac.update(body);
    const signature = hmac.digest("base64");

    const request = new Request("http://localhost/webhook", {
      method: "POST",
      body: body,
      headers: { "x-amz-sns-message-signature": signature },
    });

    mockSelect.mockReturnValue({ from: mockFrom });
    mockFrom.mockReturnValue({ where: mockWhere });
    mockWhere.mockReturnValue({ limit: mockLimit });
    mockLimit.mockReturnValue({ execute: mockExecute });
    mockExecute.mockRejectedValue(new Error("Database connection failed"));

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Failed to process SES webhook");
  });

  it("should handle malformed JSON gracefully", async () => {
    const body = "invalid json";
    const hmac = createHmac("sha256", mockEnv.SES_WEBHOOK_SECRET);
    hmac.update(body);
    const signature = hmac.digest("base64");

    const request = new Request("http://localhost/webhook", {
      method: "POST",
      body: body,
      headers: { "x-amz-sns-message-signature": signature },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Failed to process SES webhook");
  });
});
