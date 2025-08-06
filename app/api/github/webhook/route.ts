import { NextResponse } from "next/server";
import { createHmac } from "node:crypto";

interface GitHubIssue {
  number: number;
  title: string;
  user: {
    login: string;
  };
}

interface GitHubRepository {
  full_name: string;
}

interface GitHubSender {
  login: string;
}

interface GitHubWebhookPayload {
  action: string;
  issue: GitHubIssue;
  repository: GitHubRepository;
  sender: GitHubSender;
}

export async function POST(request: Request) {
  try {
    const body = await request.text();
    const githubWebhookSecret = process.env.GITHUB_WEBHOOK_SECRET;
    
    if (!githubWebhookSecret) {
      console.error("GITHUB_WEBHOOK_SECRET environment variable is not set");
      return NextResponse.json(
        { error: "GitHub webhook configuration missing" },
        { status: 500 }
      );
    }

    const githubSignature = request.headers.get("x-hub-signature-256");
    
    if (!githubSignature) {
      console.error("Missing x-hub-signature-256 header");
      return NextResponse.json(
        { error: "Missing x-hub-signature-256 header" },
        { status: 400 }
      );
    }

    const hmac = createHmac("sha256", githubWebhookSecret);
    hmac.update(body);
    const expectedSignature = `sha256=${hmac.digest("hex")}`;
    
    if (githubSignature !== expectedSignature) {
      console.error("GitHub webhook signature verification failed");
      return NextResponse.json(
        { error: "Webhook signature verification failed" },
        { status: 400 }
      );
    }

    const payload = JSON.parse(body) as GitHubWebhookPayload;
    const eventType = request.headers.get("x-github-event");

    console.log(`Received GitHub webhook event: ${eventType}`);

    if (eventType === "issues") {
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
    } else {
      console.log(`Unhandled event type: ${eventType}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Error processing GitHub webhook:", error);
    return NextResponse.json(
      { error: "Failed to process GitHub webhook" },
      { status: 500 }
    );
  }
}

async function handleIssueOpened(payload: GitHubWebhookPayload) {
  console.log("Issue opened:", {
    issueNumber: payload.issue.number,
    title: payload.issue.title,
    repository: payload.repository.full_name,
    author: payload.issue.user.login
  });
}

async function handleIssueClosed(payload: GitHubWebhookPayload) {
  console.log("Issue closed:", {
    issueNumber: payload.issue.number,
    title: payload.issue.title,
    repository: payload.repository.full_name,
    closedBy: payload.sender.login
  });
}
