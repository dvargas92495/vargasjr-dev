import { ApplicationsTable, ApplicationWorkspacesTable } from "@/db/schema";
import { z } from "zod";
import { getDb } from "@/db/connection";
import { withApiWrapper } from "@/utils/api-wrapper";
import { AppTypes } from "@/db/constants";

const applicationSchema = z.object({
  name: z.string(),
  appType: z.enum(AppTypes),
  clientId: z.string().trim().optional(),
  clientSecret: z.string().trim().optional(),
  accessToken: z.string().optional(),
  refreshToken: z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.appType === "TWILIO" && data.clientId) {
    const twilioAccountSidRegex = /^AC[0-9a-fA-F]{32}$/;
    if (!twilioAccountSidRegex.test(data.clientId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Twilio Account SID must start with 'AC' (uppercase) followed by 32 hexadecimal characters",
        path: ["clientId"],
      });
    }
  }
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

  return { id: application.id };
}

export const POST = withApiWrapper(createApplicationHandler);
