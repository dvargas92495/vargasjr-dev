import { ApplicationsTable, ApplicationWorkspacesTable } from "@/db/schema";
import { z } from "zod";
import { getDb } from "@/db/connection";
import { withApiWrapper } from "@/utils/api-wrapper";

const applicationSchema = z.object({
  name: z.string(),
  appType: z.string(),
  clientId: z.string().optional(),
  clientSecret: z.string().optional(),
  accessToken: z.string().optional(),
  refreshToken: z.string().optional(),
});

async function createApplicationHandler(body: unknown) {
  const { name, appType, clientId, clientSecret, accessToken, refreshToken } =
    applicationSchema.parse(body);

  const db = getDb();

  const [application] = await db
    .insert(ApplicationsTable)
    .values({ name, appType, clientId, clientSecret })
    .returning({ id: ApplicationsTable.id });

  if (appType === "TWITTER" && (accessToken || refreshToken)) {
    await db.insert(ApplicationWorkspacesTable).values({
      applicationId: application.id,
      name: `${name} Workspace`,
      clientId,
      clientSecret,
      accessToken,
      refreshToken,
    });
  }

  if (appType === "CAPITAL_ONE") {
  }

  return { id: application.id };
}

export const POST = withApiWrapper(createApplicationHandler);
