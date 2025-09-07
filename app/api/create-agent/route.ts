import { cookies } from "next/headers";
import { getGitHubAuthHeaders } from "../../lib/github-auth";
import { getEnvironmentPrefix } from "../constants";
import { retryWithBackoff } from "@/server/retry";
import { withApiWrapper } from "@/utils/api-wrapper";

const PRODUCTION_AGENT_NAME = "vargas-jr";

async function getCurrentPRNumber(): Promise<string> {
  if (
    process.env.VERCEL_GIT_PULL_REQUEST_ID &&
    process.env.VERCEL_GIT_PULL_REQUEST_ID !== "null"
  ) {
    return process.env.VERCEL_GIT_PULL_REQUEST_ID;
  }

  const commitRef = process.env.VERCEL_GIT_COMMIT_REF;
  if (commitRef) {
    const branchName = commitRef.replace("refs/heads/", "");
    const githubRepo = "dvargas92495/vargasjr-dev";

    if (!branchName) {
      console.log(
        "⚠️ Branch name could not be determined from VERCEL_GIT_COMMIT_REF, using fallback"
      );
      return "local-dev";
    }

    if (githubRepo && branchName) {
      try {
        const prNumber = await retryWithBackoff(
          async () => {
            const [owner] = githubRepo.split("/");
            const headFilter = `${owner}:${branchName}`;

            const headers = await getGitHubAuthHeaders();
            const response = await fetch(
              `https://api.github.com/repos/${githubRepo}/pulls?head=${headFilter}&state=open`,
              {
                headers,
              }
            );

            if (!response.ok) {
              throw new Error(
                `GitHub API error: ${response.status} ${response.statusText}`
              );
            }

            const prs = await response.json();
            if (prs.length === 1) {
              return prs[0].number.toString();
            } else if (prs.length === 0) {
              throw new Error(`No open PRs found for branch: ${branchName}`);
            } else {
              throw new Error(
                `Multiple open PRs found for branch: ${branchName}`
              );
            }
          },
          3,
          2000
        );

        return prNumber;
      } catch (error) {
        console.log(`⚠️ GitHub API lookup failed, using fallback: ${error}`);
        return "local-dev";
      }
    }
  }

  console.log(
    "⚠️ Running in local development mode - no Vercel environment variables found"
  );
  return "local-dev";
}

async function createAgentHandler() {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin-token");

  if (token?.value !== process.env.ADMIN_TOKEN) {
    throw new Error("Unauthorized");
  }

  const environmentPrefix = getEnvironmentPrefix();
  let agentName: string;
  let message: string;

  if (environmentPrefix === "PREVIEW") {
    const prNumber = await getCurrentPRNumber();
    agentName = `pr-${prNumber}`;
    message = `Preview agent creation workflow dispatched for PR #${prNumber}. This process will take several minutes.`;
  } else {
    agentName = PRODUCTION_AGENT_NAME;
    message = `Production agent creation workflow dispatched. This process will take several minutes.`;
  }

  const headers = await getGitHubAuthHeaders();

  const response = await fetch(
    `https://api.github.com/repos/dvargas92495/vargasjr-dev/actions/workflows/ci.yaml/dispatches`,
    {
      method: "POST",
      headers: {
        ...headers,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ref: "main",
        inputs: {
          agent_name: agentName,
        },
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error("GitHub API error:", errorText);
    throw new Error("Failed to dispatch workflow");
  }

  return {
    success: true,
    message,
  };
}

export const POST = withApiWrapper(createAgentHandler);
