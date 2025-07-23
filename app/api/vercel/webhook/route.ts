import { NextResponse } from "next/server";
import { createHmac } from "node:crypto";
import { postGitHubComment } from "../../../../scripts/utils";

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
  console.log("Deployment error:", {
    deploymentId: payload.payload.deployment.id,
    deploymentUrl: payload.payload.deployment.url,
    dashboardLink: payload.payload.links.deployment,
    target: payload.payload.target
  });

  try {
    const prNumber = extractPRNumber(payload.payload.deployment.meta);
    
    if (!prNumber) {
      console.log("No PR number found in deployment metadata, skipping PR comment");
      return;
    }

    const buildLogs = await fetchVercelBuildLogs(payload.payload.deployment.id);
    
    const comment = formatBuildLogsComment(payload, buildLogs);
    
    await postGitHubComment(
      comment,
      "vargasjr-dev-vercel-webhook/1.0",
      "Posted Vercel build logs to PR"
    );

    console.log(`Successfully posted build logs to PR #${prNumber}`);
    
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
  
  if (prNumber) {
    return prNumber;
  }

  const branchName = meta.githubCommitRef || meta.gitBranch || meta.branch;
  if (branchName) {
    const prMatch = branchName.match(/pr[/-](\d+)/i);
    if (prMatch) {
      return prMatch[1];
    }
  }

  return null;
}

async function fetchVercelBuildLogs(deploymentId: string): Promise<string> {
  const vercelToken = process.env.VERCEL_TOKEN;
  const vercelTeamId = process.env.VERCEL_TEAM_ID;
  
  if (!vercelToken) {
    throw new Error("VERCEL_TOKEN environment variable is not set");
  }

  try {
    const url = new URL(`https://api.vercel.com/v3/deployments/${deploymentId}/events`);
    url.searchParams.set('builds', '1');
    url.searchParams.set('statusCode', '5xx');
    if (vercelTeamId) {
      url.searchParams.set('teamId', vercelTeamId);
    }

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
