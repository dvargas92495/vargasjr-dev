import { describe, it, expect, vi, beforeEach } from "vitest";
import { createHmac } from "node:crypto";
import { POST } from "../api/ses/webhook/route";

const mockAddInboxMessage = vi.hoisted(() => vi.fn());

const mockEnv = vi.hoisted(() => ({
  SES_WEBHOOK_SECRET: "test_ses_webhook_secret"
}));

// eslint-disable-next-line custom/no-mock-internal-modules
vi.mock("@/server", () => ({
  addInboxMessage: mockAddInboxMessage
}));

// eslint-disable-next-line custom/no-mock-internal-modules
vi.mock("@/server/errors", () => ({
  NotFoundError: class NotFoundError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "NotFoundError";
    }
  }
}));

describe("SES Webhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SES_WEBHOOK_SECRET = mockEnv.SES_WEBHOOK_SECRET;
  });

  it("should return 500 when SES_WEBHOOK_SECRET is missing", async () => {
    delete process.env.SES_WEBHOOK_SECRET;
    
    const request = new Request("http://localhost/webhook", {
      method: "POST",
      body: JSON.stringify({ test: "data" }),
      headers: { "x-amz-sns-message-signature": "test_signature" }
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("SES webhook configuration missing");
  });

  it("should return 400 when x-amz-sns-message-signature header is missing", async () => {
    const request = new Request("http://localhost/webhook", {
      method: "POST",
      body: JSON.stringify({ test: "data" })
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
      headers: { "x-amz-sns-message-signature": "invalid_signature" }
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Webhook signature verification failed");
  });

  it("should successfully process SES email notification", async () => {
    const mockPayload = {
      Records: [{
        ses: {
          mail: {
            messageId: "test-message-id-123",
            commonHeaders: {
              from: ["sender@example.com"],
              subject: "Test Email Subject",
              to: ["recipient@example.com"]
            }
          },
          receipt: {
            recipients: ["recipient@example.com"],
            timestamp: "2023-12-01T10:00:00.000Z"
          }
        }
      }]
    };

    const body = JSON.stringify(mockPayload);
    const hmac = createHmac("sha256", mockEnv.SES_WEBHOOK_SECRET);
    hmac.update(body);
    const signature = hmac.digest("base64");

    const request = new Request("http://localhost/webhook", {
      method: "POST",
      body: body,
      headers: { "x-amz-sns-message-signature": signature }
    });

    mockAddInboxMessage.mockResolvedValue(undefined);

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.received).toBe(true);
    expect(mockAddInboxMessage).toHaveBeenCalledWith({
      body: "Subject: Test Email Subject\nMessage ID: test-message-id-123\nTimestamp: 2023-12-01T10:00:00.000Z",
      source: "sender@example.com",
      inboxName: "ses-email"
    });
  });

  it("should handle missing sender gracefully", async () => {
    const mockPayload = {
      Records: [{
        ses: {
          mail: {
            messageId: "test-message-id-456",
            commonHeaders: {
              from: [],
              subject: "Test Email Subject",
              to: ["recipient@example.com"]
            }
          },
          receipt: {
            recipients: ["recipient@example.com"],
            timestamp: "2023-12-01T10:00:00.000Z"
          }
        }
      }]
    };

    const body = JSON.stringify(mockPayload);
    const hmac = createHmac("sha256", mockEnv.SES_WEBHOOK_SECRET);
    hmac.update(body);
    const signature = hmac.digest("base64");

    const request = new Request("http://localhost/webhook", {
      method: "POST",
      body: body,
      headers: { "x-amz-sns-message-signature": signature }
    });

    mockAddInboxMessage.mockResolvedValue(undefined);

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.received).toBe(true);
    expect(mockAddInboxMessage).toHaveBeenCalledWith({
      body: "Subject: Test Email Subject\nMessage ID: test-message-id-456\nTimestamp: 2023-12-01T10:00:00.000Z",
      source: "unknown",
      inboxName: "ses-email"
    });
  });

  it("should handle missing subject gracefully", async () => {
    const mockPayload = {
      Records: [{
        ses: {
          mail: {
            messageId: "test-message-id-789",
            commonHeaders: {
              from: ["sender@example.com"],
              subject: undefined,
              to: ["recipient@example.com"]
            }
          },
          receipt: {
            recipients: ["recipient@example.com"],
            timestamp: "2023-12-01T10:00:00.000Z"
          }
        }
      }]
    };

    const body = JSON.stringify(mockPayload);
    const hmac = createHmac("sha256", mockEnv.SES_WEBHOOK_SECRET);
    hmac.update(body);
    const signature = hmac.digest("base64");

    const request = new Request("http://localhost/webhook", {
      method: "POST",
      body: body,
      headers: { "x-amz-sns-message-signature": signature }
    });

    mockAddInboxMessage.mockResolvedValue(undefined);

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.received).toBe(true);
    expect(mockAddInboxMessage).toHaveBeenCalledWith({
      body: "Subject: No Subject\nMessage ID: test-message-id-789\nTimestamp: 2023-12-01T10:00:00.000Z",
      source: "sender@example.com",
      inboxName: "ses-email"
    });
  });

  it("should return 404 when inbox is not found", async () => {
    const mockPayload = {
      Records: [{
        ses: {
          mail: {
            messageId: "test-message-id-404",
            commonHeaders: {
              from: ["sender@example.com"],
              subject: "Test Email Subject",
              to: ["recipient@example.com"]
            }
          },
          receipt: {
            recipients: ["recipient@example.com"],
            timestamp: "2023-12-01T10:00:00.000Z"
          }
        }
      }]
    };

    const body = JSON.stringify(mockPayload);
    const hmac = createHmac("sha256", mockEnv.SES_WEBHOOK_SECRET);
    hmac.update(body);
    const signature = hmac.digest("base64");

    const request = new Request("http://localhost/webhook", {
      method: "POST",
      body: body,
      headers: { "x-amz-sns-message-signature": signature }
    });

    const { NotFoundError } = await import("@/server/errors");
    mockAddInboxMessage.mockRejectedValue(new NotFoundError("Inbox not found"));

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe("Inbox not found");
  });

  it("should return 500 for general errors", async () => {
    const mockPayload = {
      Records: [{
        ses: {
          mail: {
            messageId: "test-message-id-error",
            commonHeaders: {
              from: ["sender@example.com"],
              subject: "Test Email Subject",
              to: ["recipient@example.com"]
            }
          },
          receipt: {
            recipients: ["recipient@example.com"],
            timestamp: "2023-12-01T10:00:00.000Z"
          }
        }
      }]
    };

    const body = JSON.stringify(mockPayload);
    const hmac = createHmac("sha256", mockEnv.SES_WEBHOOK_SECRET);
    hmac.update(body);
    const signature = hmac.digest("base64");

    const request = new Request("http://localhost/webhook", {
      method: "POST",
      body: body,
      headers: { "x-amz-sns-message-signature": signature }
    });

    mockAddInboxMessage.mockRejectedValue(new Error("Database connection failed"));

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
      headers: { "x-amz-sns-message-signature": signature }
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Failed to process SES webhook");
  });
});
