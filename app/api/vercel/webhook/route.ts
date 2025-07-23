import { NextResponse } from "next/server";
import { createHmac } from "node:crypto";
// @ts-expect-error - jsonwebtoken types are available through twilio dependency
import jwt from "jsonwebtoken";

const VERCEL_TEAM_ID = "team_36iZPJkU2LLMsHZqJZXMZppe";
const GITHUB_APP_ID = process.env.GITHUB_APP_ID;
const GITHUB_INSTALLATION_ID = process.env.GITHUB_INSTALLATION_ID;

interface VercelDeployment {
  id: string;
  meta: Record<string, string>;
  url: string;
  name: string;
}

interface VercelDeploymentEvent {
  type: string;
  payload: string | { text?: string };
}

interface VercelWebhookPayload {
  type: string;
  id: string;
  createdAt: string;
  region: string;
  payload: {
    team?: { id: string };
    user: { id: string };
    deployment: VercelDeployment;
    links: {
      deployment: string;
      project: string;
    };
    target: string;
    project: { id: string };
    plan: string;
    regions: string[];
  };
}

export async function POST(request: Request) {
  try {
    const body = await request.text();
    const vercelWebhookSecret = process.env.VERCEL_WEBHOOK_SECRET;
    
    if (!vercelWebhookSecret) {
      console.error("VERCEL_WEBHOOK_SECRET environment variable is not set");
      return NextResponse.json(
        { error: "Vercel webhook configuration missing" },
        { status: 500 }
      );
    }

    const vercelSignature = request.headers.get("x-vercel-signature");
    
    if (!vercelSignature) {
      console.error("Missing x-vercel-signature header");
      return NextResponse.json(
        { error: "Missing x-vercel-signature header" },
        { status: 400 }
      );
    }

    const hmac = createHmac("sha1", vercelWebhookSecret);
    hmac.update(body);
    const expectedSignature = hmac.digest("hex");
    
    if (vercelSignature !== expectedSignature) {
      console.error("Vercel webhook signature verification failed");
      return NextResponse.json(
        { error: "Webhook signature verification failed" },
        { status: 400 }
      );
    }

    const payload = JSON.parse(body) as VercelWebhookPayload;
    const eventType = payload.type;

    console.log(`Received Vercel webhook event: ${eventType}`);

    if (eventType === "deployment.error") {
      await handleDeploymentError(payload);
    } else {
      console.log(`Unhandled event type: ${eventType}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Error processing Vercel webhook:", error);
    return NextResponse.json(
      { error: "Failed to process Vercel webhook" },
      { status: 500 }
    );
  }
}

async function handleDeploymentError(payload: VercelWebhookPayload) {
  try {
    const prNumber = extractPRNumber(payload.payload.deployment.meta);
    
    if (!prNumber) {
      console.log("No PR number found in deployment metadata, skipping PR comment");
      return;
    }

    const buildLogs = await fetchVercelBuildLogs(payload.payload.deployment.id);
    
    const comment = formatBuildLogsComment(payload, buildLogs);
    
    await postGitHubPRComment(prNumber, comment);
    
  } catch (error) {
    console.error("Error handling deployment error:", error);
    throw error;
  }
}

function extractPRNumber(meta: Record<string, string>): string | null {
  const prNumber = meta.githubPullRequestId || 
                   meta.gitlabMergeRequestId || 
                   meta.pullRequestId ||
                   meta.prNumber;
  
  return prNumber || null;
}

async function fetchVercelBuildLogs(deploymentId: string): Promise<string> {
  const vercelToken = process.env.VERCEL_TOKEN;
  
  if (!vercelToken) {
    throw new Error("VERCEL_TOKEN environment variable is not set");
  }

  try {
    const url = new URL(`https://api.vercel.com/v3/deployments/${deploymentId}/events`);
    url.searchParams.set('builds', '1');
    url.searchParams.set('statusCode', '5xx');
    url.searchParams.set('teamId', VERCEL_TEAM_ID);

    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': `Bearer ${vercelToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Vercel API error: ${response.status} ${response.statusText}`);
    }

    const events = await response.json();
    
    const buildLogEvents = events.filter((event: VercelDeploymentEvent) => 
      event.type === 'stdout' || event.type === 'stderr' || event.type === 'command'
    );

    if (buildLogEvents.length === 0) {
      return "No build logs available for this failed deployment.";
    }

    return buildLogEvents
      .map((event: VercelDeploymentEvent) => {
        const text = typeof event.payload === 'string' 
          ? event.payload 
          : event.payload.text || '';
        return `[${event.type}] ${text}`;
      })
      .join('\n');
      
  } catch (error) {
    console.error("Error fetching Vercel build logs:", error);
    return `Error fetching build logs: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
}

async function generateGitHubAppToken(): Promise<string> {
  const privateKey = process.env.GITHUB_PRIVATE_KEY;
  
  if (!privateKey || !GITHUB_APP_ID || !GITHUB_INSTALLATION_ID) {
    throw new Error("Missing GitHub App configuration: GITHUB_PRIVATE_KEY, GITHUB_APP_ID, or GITHUB_INSTALLATION_ID");
  }

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iat: now - 60,
    exp: now + (10 * 60),
    iss: GITHUB_APP_ID
  };

  const jwtToken = jwt.sign(payload, privateKey, { algorithm: 'RS256' });

  const response = await fetch(`https://api.github.com/app/installations/${GITHUB_INSTALLATION_ID}/access_tokens`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${jwtToken}`,
      'Accept': 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28'
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to get GitHub installation token: ${response.status} ${response.statusText}`);
  }

  const tokenData = await response.json();
  return tokenData.token;
}

async function postGitHubPRComment(prNumber: string, comment: string): Promise<void> {
  const githubRepo = process.env.GITHUB_REPOSITORY || "dvargas92495/vargasjr-dev";
  
  try {
    const token = await generateGitHubAppToken();
    
    const response = await fetch(`https://api.github.com/repos/${githubRepo}/issues/${prNumber}/comments`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'vargasjr-dev-vercel-webhook/1.0'
      },
      body: JSON.stringify({
        body: comment
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to post GitHub comment: ${response.status} ${response.statusText}`);
    }

    console.log(`✅ Posted Vercel build logs to PR #${prNumber}`);
  } catch (error) {
    console.error("Failed to post GitHub comment:", error);
    throw error;
  }
}

function formatBuildLogsComment(payload: VercelWebhookPayload, buildLogs: string): string {
  const deployment = payload.payload.deployment;
  const dashboardLink = payload.payload.links.deployment;
  
  return `## 🚨 Vercel Deployment Failed

**Deployment Details:**
- **Deployment ID:** \`${deployment.id}\`
- **URL:** ${deployment.url}
- **Target:** ${payload.payload.target || 'preview'}
- **Dashboard:** [View on Vercel](${dashboardLink})

**Build Logs:**
\`\`\`
${buildLogs}
\`\`\`

---
*This comment was automatically generated by the Vercel webhook integration.*`;
}
