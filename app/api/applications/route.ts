import { ApplicationsTable, ApplicationWorkspacesTable } from "@/db/schema";
import { z } from "zod";
import { getDb } from "@/db/connection";
import { withApiWrapper } from "@/utils/api-wrapper";

const applicationSchema = z.object({
  name: z.string(),
  clientId: z.string().optional(),
  clientSecret: z.string().optional(),
  accessToken: z.string().optional(),
  refreshToken: z.string().optional(),
});

async function createApplicationHandler(body: unknown) {
  const { name, clientId, clientSecret, accessToken, refreshToken } =
    applicationSchema.parse(body);

  const db = getDb();

  const [application] = await db
    .insert(ApplicationsTable)
    .values({ name, clientId, clientSecret })
    .returning({ id: ApplicationsTable.id });

  if (name.toLowerCase().includes("twitter") && (accessToken || refreshToken)) {
    await db.insert(ApplicationWorkspacesTable).values({
      applicationId: application.id,
      name: `${name} Workspace`,
      clientId,
      clientSecret,
      accessToken,
      refreshToken,
    });
  }

  return { id: application.id };
}

export const POST = withApiWrapper(createApplicationHandler);
