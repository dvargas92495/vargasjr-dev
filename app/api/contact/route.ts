import { z } from "zod";
import { addInboxMessage } from "@/server";
import { withApiWrapper } from "@/utils/api-wrapper";

async function contactFormHandler(body: unknown) {
  const { email, message } = z
    .object({
      email: z.string().email(),
      message: z.string(),
    })
    .parse(body);

  await addInboxMessage({
    body: message,
    source: email,
    inboxName: "landing-page",
  });

  return { success: true };
}

export const POST = withApiWrapper(contactFormHandler);
