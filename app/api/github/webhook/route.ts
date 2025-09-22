import { createHmac } from "node:crypto";
import { withApiWrapper } from "@/utils/api-wrapper";
import { z } from "zod";

const githubIssueSchema = z.object({
  number: z.number(),
  title: z.string(),
  user: z.object({
    login: z.string(),
  }),
});

const githubRepositorySchema = z.object({
  full_name: z.string(),
});

const githubSenderSchema = z.object({
  login: z.string(),
});

const githubWebhookPayloadSchema = z.object({
  action: z.string(),
  issue: githubIssueSchema,
  repository: githubRepositorySchema,
  sender: githubSenderSchema,
});

type GitHubWebhookPayload = z.infer<typeof githubWebhookPayloadSchema>;

async function validateGitHubSignature(request: Request): Promise<unknown> {
  const body = await request.text();
  const githubWebhookSecret = process.env.GITHUB_WEBHOOK_SECRET;

  if (!githubWebhookSecret) {
    console.error("GITHUB_WEBHOOK_SECRET environment variable is not set");
    throw new Error("GitHub webhook configuration missing");
  }

  const githubSignature = request.headers.get("x-hub-signature-256");

  if (!githubSignature) {
    console.error("Missing x-hub-signature-256 header");
    throw new Error("Missing x-hub-signature-256 header");
  }

  const hmac = createHmac("sha256", githubWebhookSecret);
  hmac.update(body);
  const expectedSignature = `sha256=${hmac.digest("hex")}`;

  if (githubSignature !== expectedSignature) {
    console.error("GitHub webhook signature verification failed");
    throw new Error("Webhook signature verification failed");
  }

  return JSON.parse(body);
}

async function githubWebhookHandler(body: unknown) {
  const payload = githubWebhookPayloadSchema.parse(body);

  console.log("Received GitHub webhook event");

  switch (payload.action) {
    case "opened":
      await handleIssueOpened(payload);
      break;
    case "closed":
      await handleIssueClosed(payload);
      break;
    default:
      console.log(`Unhandled issues action: ${payload.action}`);
  }

  return { received: true };
}

export const POST = withApiWrapper(githubWebhookHandler, {
  getBody: validateGitHubSignature,
});

async function handleIssueOpened(payload: GitHubWebhookPayload) {
  console.log("Issue opened:", {
    issueNumber: payload.issue.number,
    title: payload.issue.title,
    repository: payload.repository.full_name,
    author: payload.issue.user.login,
  });
}

async function handleIssueClosed(payload: GitHubWebhookPayload) {
  console.log("Issue closed:", {
    issueNumber: payload.issue.number,
    title: payload.issue.title,
    repository: payload.repository.full_name,
    closedBy: payload.sender.login,
  });
}
