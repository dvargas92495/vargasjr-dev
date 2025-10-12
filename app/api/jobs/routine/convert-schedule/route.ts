import { z } from "zod";
import { VellumClient } from "vellum-ai";
import { getEnvironmentMetadata } from "../../../constants";
import { withApiWrapper } from "@/utils/api-wrapper";

const convertScheduleSchema = z.object({
  scheduleDescription: z.string().min(1, "scheduleDescription is required"),
});

export const POST = withApiWrapper(async (body: unknown) => {
  const { scheduleDescription } = convertScheduleSchema.parse(body);

  const apiKey = process.env.VELLUM_API_KEY;
  if (!apiKey) {
    throw new Error("VELLUM_API_KEY environment variable is required");
  }

  const vellumClient = new VellumClient({ apiKey });

  const response = await vellumClient.executeWorkflow({
    workflowDeploymentName: "schedule-to-cron",
    inputs: [
      {
        name: "schedule_description",
        value: scheduleDescription,
        type: "STRING",
      },
    ],
    metadata: {
      environment: await getEnvironmentMetadata(),
      location: "schedule-conversion",
    },
  });

  if (response.data.state !== "FULFILLED") {
    let errorMessage = "Workflow execution failed";
    if (response.data.error) {
      const errorParts: string[] = [];
      if (response.data.error.message) {
        errorParts.push(response.data.error.message);
      }
      if (response.data.error.code) {
        errorParts.push(`(Code: ${response.data.error.code})`);
      }
      if (errorParts.length > 0) {
        errorMessage = `Workflow execution failed: ${errorParts.join(" ")}`;
      }
    }
    throw new Error(errorMessage);
  }

  if (!response.data.outputs) {
    console.error(
      "Workflow returned no outputs. Full response:",
      JSON.stringify(response.data, null, 2)
    );
    throw new Error("Workflow execution failed or returned no outputs");
  }

  const cronOutput = response.data.outputs.find(
    (output) => output.name === "cron_expression"
  );
  if (!cronOutput || typeof cronOutput.value !== "string") {
    throw new Error(
      'Unable to understand the schedule description. Please try a clearer format like "every Monday at 5pm" or "daily at 9am"'
    );
  }

  return { cronExpression: cronOutput.value };
});
