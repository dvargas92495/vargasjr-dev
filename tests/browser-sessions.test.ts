import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { AgentRunner } from "../worker/runner";
import { AGENT_SERVER_PORT } from "../server/constants";

describe("Browser Sessions API through Proxy", () => {
  let agentRunner: AgentRunner;
  const testPort = AGENT_SERVER_PORT + 20;
  const testAdminToken = "test-admin-token";

  beforeAll(async () => {
    process.env.AGENT_SERVER_PORT = testPort.toString();
    process.env.LOG_LEVEL = "error";
    process.env.ENABLE_BROWSER = "true";
    process.env.ADMIN_TOKEN = testAdminToken;

    agentRunner = new AgentRunner({
      sleepTime: 0.1,
      maxLoops: 1,
    });

    await agentRunner.run();

    await new Promise((resolve) => setTimeout(resolve, 3000));
  });

  afterAll(async () => {
    if (agentRunner) {
      await agentRunner.stop();
    }
  });

  it("should return browser sessions through proxy", async () => {
    const response = await fetch(
      `http://localhost:${testPort}/api/browser-sessions`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${testAdminToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ instanceId: "i-test123" }),
      }
    );

    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data).toHaveProperty("sessions");
    expect(Array.isArray(data.sessions)).toBe(true);
    expect(data.sessions).toHaveLength(0);
  });

  it("should require authentication", async () => {
    const response = await fetch(
      `http://localhost:${testPort}/api/browser-sessions`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ instanceId: "i-test123" }),
      }
    );

    expect(response.status).toBe(401);

    const data = await response.json();
    expect(data.status).toBe("error");
    expect(data.message).toBe("Authorization header required");
  });

  it("should reject invalid tokens", async () => {
    const response = await fetch(
      `http://localhost:${testPort}/api/browser-sessions`,
      {
        method: "POST",
        headers: {
          Authorization: "Bearer invalid-token",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ instanceId: "i-test123" }),
      }
    );

    expect(response.status).toBe(401);

    const data = await response.json();
    expect(data.status).toBe("error");
    expect(data.message).toBe("Invalid authorization token");
  });
});
