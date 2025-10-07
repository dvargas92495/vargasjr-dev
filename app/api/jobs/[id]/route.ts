import { JobsTable } from "@/db/schema";
import { getDb } from "@/db/connection";
import { convertPriorityToLabel } from "@/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { withApiWrapper } from "@/utils/api-wrapper";
import { NotFoundError } from "@/server/errors";

async function getJobHandler(body: unknown) {
  const { id } = z.object({ id: z.string() }).parse(body || {});
  const db = getDb();
  const job = await db
    .select()
    .from(JobsTable)
    .where(eq(JobsTable.id, id))
    .then((results) => results[0]);

  if (!job) {
    throw new NotFoundError("Job not found");
  }

  const jobWithLabel = {
    ...job,
    priority: convertPriorityToLabel(job.priority),
  };

  return jobWithLabel;
}

export const GET = withApiWrapper(getJobHandler);
