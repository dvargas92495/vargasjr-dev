import { z } from "zod";
import { withApiWrapper } from "@/utils/api-wrapper";

const validateTokenSchema = z.object({
  token: z.string().min(1),
});

async function validateTokenHandler(body: unknown) {
  const { token } = validateTokenSchema.parse(body);

  if (token === process.env.ADMIN_TOKEN) {
    return { valid: true };
  } else {
    return { valid: false };
  }
}

export const POST = withApiWrapper(validateTokenHandler);
