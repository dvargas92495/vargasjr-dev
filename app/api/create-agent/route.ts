import { cookies } from "next/headers";
import { getGitHubAuthHeaders } from "../../lib/github-auth";
import { getEnvironmentPrefix, getPRNumber } from "../constants";
import { withApiWrapper } from "@/utils/api-wrapper";

const PRODUCTION_AGENT_NAME = "vargas-jr";

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
    const prNumber = await getPRNumber();
    agentName = `pr-${prNumber}`;
    message = `Preview agent creation workflow dispatched for PR #${prNumber}. This process will take several minutes.`;
  } else {
    agentName = PRODUCTION_AGENT_NAME;
    message = `Production agent creation workflow dispatched. This process will take several minutes.`;
  }

  const headers = await getGitHubAuthHeaders();

  const workflowFile =
    environmentPrefix === "PREVIEW"
      ? "ci.yaml"
      : "create-production-agent.yaml";

  const response = await fetch(
    `https://api.github.com/repos/dvargas92495/vargasjr-dev/actions/workflows/${workflowFile}/dispatches`,
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
