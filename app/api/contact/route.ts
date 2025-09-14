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

  const contactId = await upsertEmailContact(email);

  await addInboxMessage({
    body: message,
    inboxName: "landing-page",
    contactId: contactId,
  });

  return { success: true };
}

export const POST = withApiWrapper(contactFormHandler);
