import { VellumClient } from "vellum-ai";
import { withApiWrapper } from "@/utils/api-wrapper";

async function getWorkflowDeploymentsHandler() {
  const apiKey = process.env.VELLUM_API_KEY;

  if (!apiKey) {
    console.error("VELLUM_API_KEY environment variable is missing");
    throw new Error("VELLUM_API_KEY environment variable is required");
  }

  const vellumClient = new VellumClient({
    apiKey: apiKey,
  });

  const response = await vellumClient.workflowDeployments.list();

  return response.results || [];
}

export const GET = withApiWrapper(getWorkflowDeploymentsHandler);
