import { z } from "zod";
import { withApiWrapper } from "@/utils/api-wrapper";
import { addInboxMessage, upsertEmailContact } from "@/server";

async function contactFormHandler(body: unknown) {
  const { email, message } = z
    .object({
      email: z.string().email(),
      message: z.string(),
    })
    .parse(body);

  await upsertEmailContact(email);

  await addInboxMessage({
    body: message,
    source: email,
    inboxName: "landing-page",
  });

  return { success: true };
}

export const POST = withApiWrapper(contactFormHandler);
