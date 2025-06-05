import { describe, it, expect, vi, beforeEach } from "vitest";
import { createHmac } from "node:crypto";
import { POST } from "../api/github/webhook/route";

const mockEnv = vi.hoisted(() => ({
  GITHUB_WEBHOOK_SECRET: "test_webhook_secret"
}));

describe("GitHub Webhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GITHUB_WEBHOOK_SECRET = mockEnv.GITHUB_WEBHOOK_SECRET;
  });

  it("should return 500 when GITHUB_WEBHOOK_SECRET is missing", async () => {
    delete process.env.GITHUB_WEBHOOK_SECRET;
    
    const request = new Request("http://localhost/webhook", {
      method: "POST",
      body: JSON.stringify({ test: "data" }),
      headers: { "x-hub-signature-256": "sha256=test_signature" }
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("GitHub webhook configuration missing");
  });

  it("should return 400 when x-hub-signature-256 header is missing", async () => {
    const request = new Request("http://localhost/webhook", {
      method: "POST",
      body: JSON.stringify({ test: "data" })
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Missing x-hub-signature-256 header");
  });

  it("should return 400 when webhook signature verification fails", async () => {
    const request = new Request("http://localhost/webhook", {
      method: "POST",
      body: JSON.stringify({ test: "data" }),
      headers: { "x-hub-signature-256": "sha256=invalid_signature" }
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Webhook signature verification failed");
  });

  it("should successfully process issues opened event", async () => {
    const mockPayload = {
      action: "opened",
      issue: {
        number: 123,
        title: "Test Issue",
        user: { login: "testuser" }
      },
      repository: {
        full_name: "testowner/testrepo"
      },
      sender: { login: "testuser" }
    };

    const body = JSON.stringify(mockPayload);
    const hmac = createHmac("sha256", mockEnv.GITHUB_WEBHOOK_SECRET);
    hmac.update(body);
    const signature = `sha256=${hmac.digest("hex")}`;

    const request = new Request("http://localhost/webhook", {
      method: "POST",
      body: body,
      headers: { 
        "x-hub-signature-256": signature,
        "x-github-event": "issues"
      }
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.received).toBe(true);
  });

  it("should successfully process issues closed event", async () => {
    const mockPayload = {
      action: "closed",
      issue: {
        number: 456,
        title: "Another Test Issue",
        user: { login: "testuser" }
      },
      repository: {
        full_name: "testowner/testrepo"
      },
      sender: { login: "closer" }
    };

    const body = JSON.stringify(mockPayload);
    const hmac = createHmac("sha256", mockEnv.GITHUB_WEBHOOK_SECRET);
    hmac.update(body);
    const signature = `sha256=${hmac.digest("hex")}`;

    const request = new Request("http://localhost/webhook", {
      method: "POST",
      body: body,
      headers: { 
        "x-hub-signature-256": signature,
        "x-github-event": "issues"
      }
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.received).toBe(true);
  });

  it("should handle unhandled issues actions gracefully", async () => {
    const mockPayload = {
      action: "edited",
      issue: {
        number: 789,
        title: "Edited Issue",
        user: { login: "testuser" }
      },
      repository: {
        full_name: "testowner/testrepo"
      },
      sender: { login: "editor" }
    };

    const body = JSON.stringify(mockPayload);
    const hmac = createHmac("sha256", mockEnv.GITHUB_WEBHOOK_SECRET);
    hmac.update(body);
    const signature = `sha256=${hmac.digest("hex")}`;

    const request = new Request("http://localhost/webhook", {
      method: "POST",
      body: body,
      headers: { 
        "x-hub-signature-256": signature,
        "x-github-event": "issues"
      }
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.received).toBe(true);
  });

  it("should handle unhandled event types gracefully", async () => {
    const mockPayload = {
      action: "created",
      comment: {
        body: "Test comment"
      }
    };

    const body = JSON.stringify(mockPayload);
    const hmac = createHmac("sha256", mockEnv.GITHUB_WEBHOOK_SECRET);
    hmac.update(body);
    const signature = `sha256=${hmac.digest("hex")}`;

    const request = new Request("http://localhost/webhook", {
      method: "POST",
      body: body,
      headers: { 
        "x-hub-signature-256": signature,
        "x-github-event": "issue_comment"
      }
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.received).toBe(true);
  });
});
