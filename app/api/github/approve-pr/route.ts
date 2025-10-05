import { cookies } from "next/headers";
import { getGitHubAuthHeaders } from "../../../lib/github-auth";
import { z } from "zod";
import { withApiWrapper } from "@/utils/api-wrapper";
import { UnauthorizedError } from "@/server/errors";

const approvePrSchema = z.object({
  prNumber: z.coerce.number(),
});

async function approvePrHandler(body: unknown) {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin-token");

  if (token?.value !== process.env.ADMIN_TOKEN) {
    throw new UnauthorizedError();
  }

  const { prNumber } = approvePrSchema.parse(body);

  const githubRepo = "dvargas92495/vargasjr-dev";

  try {
    const headers = await getGitHubAuthHeaders();

    const response = await fetch(
      `https://api.github.com/repos/${githubRepo}/pulls/${prNumber}/reviews`,
      {
        method: "POST",
        headers: {
          ...headers,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          event: "APPROVE",
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("GitHub API error:", errorText);
      throw new Error("Failed to approve PR");
    }

    return {
      success: true,
      message: `PR #${prNumber} approved successfully`,
    };
  } catch (authError) {
    console.error("GitHub authentication error:", authError);
    throw new Error("GitHub authentication failed");
  }
}

export const POST = withApiWrapper(approvePrHandler);
