import { z } from "zod";
import { RoutineJobsTable } from "@/db/schema";
import { getDb } from "@/db/connection";
import { VellumClient } from "vellum-ai";
import { getEnvironmentMetadata } from "../../constants";
import { withApiWrapper } from "@/utils/api-wrapper";
import { BadRequestError } from "@/server/errors";

const createRoutineJobSchema = z.object({
  name: z.string().min(1),
  scheduleDescription: z.string().min(1),
});

async function getRoutineJobsHandler() {
  const db = getDb();
  const routineJobs = await db.select().from(RoutineJobsTable);
  return routineJobs;
}

async function createRoutineJobHandler(body: unknown) {
  const { name, scheduleDescription } = createRoutineJobSchema.parse(body);

  const apiKey = process.env.VELLUM_API_KEY;
  if (!apiKey) {
    throw new Error("VELLUM_API_KEY environment variable is required");
  }

  const vellumClient = new VellumClient({ apiKey });

  let cronExpression: string;
  try {
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
        location: "routine-job-creation",
      },
    });

    if (response.data.state !== "FULFILLED") {
      let errorMessage = "Workflow execution failed";
      if (response.data.error) {
        const errorParts = [];
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
        "Failed to generate cron expression from natural language"
      );
    }

    cronExpression = cronOutput.value;
  } catch (error) {
    console.error("Failed to convert schedule description to cron:", error);
    const userMessage =
      error instanceof Error &&
      error.message.includes("Failed to generate cron expression")
        ? 'Unable to understand the schedule description. Please try a clearer format like "every Monday at 5pm" or "daily at 9am"'
        : "Failed to convert schedule description to cron expression";
    throw new BadRequestError(userMessage);
  }

  const db = getDb();
  try {
    const newRoutineJob = await db
      .insert(RoutineJobsTable)
      .values({
        name,
        cronExpression,
        enabled: true,
      })
      .returning()
      .execute();

    return newRoutineJob[0];
  } catch (error) {
    console.error("Failed to create routine job:", error);
    const userMessage =
      error instanceof Error && error.message.includes("duplicate key")
        ? "A routine job with this name already exists. Please choose a different name."
        : "Failed to create routine job";
    throw new BadRequestError(userMessage);
  }
}

export const GET = withApiWrapper(getRoutineJobsHandler);
export const POST = withApiWrapper(createRoutineJobHandler);
