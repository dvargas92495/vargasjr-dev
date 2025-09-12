import { retryWithBackoff } from "@/server/retry";
import { getGitHubAuthHeaders } from "../lib/github-auth";

export function getBaseUrl(): string {
  return process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : process.env.NODE_ENV === "production"
    ? "https://www.vargasjr.dev"
    : "http://localhost:3000";
}

export function getEnvironmentPrefix(): string {
  if (process.env.VERCEL_ENV === "preview") {
    return "PREVIEW";
  }
  if (process.env.VERCEL_ENV === "production") {
    return "";
  }
  return "DEV";
}

export async function getPRNumber(): Promise<string> {
  if (
    process.env.VERCEL_GIT_PULL_REQUEST_ID &&
    process.env.VERCEL_GIT_PULL_REQUEST_ID !== "null"
  ) {
    return process.env.VERCEL_GIT_PULL_REQUEST_ID;
  }

  const commitRef = process.env.VERCEL_GIT_COMMIT_REF;
  if (commitRef) {
    const branchName = commitRef.replace("refs/heads/", "");
    const githubRepo = "dvargas92495/vargasjr-dev";

    if (!branchName) {
      console.log(
        "⚠️ Branch name could not be determined from VERCEL_GIT_COMMIT_REF, using fallback"
      );
      return "local-dev";
    }

    if (githubRepo && branchName) {
      try {
        const prNumber = await retryWithBackoff(
          async () => {
            const [owner] = githubRepo.split("/");
            const headFilter = `${owner}:${branchName}`;

            const headers = await getGitHubAuthHeaders();
            const response = await fetch(
              `https://api.github.com/repos/${githubRepo}/pulls?head=${headFilter}&state=open`,
              {
                headers,
              }
            );

            if (!response.ok) {
              throw new Error(
                `GitHub API error: ${response.status} ${response.statusText}`
              );
            }

            const prs = await response.json();
            if (prs.length === 1) {
              return prs[0].number.toString();
            } else if (prs.length === 0) {
              throw new Error(`No open PRs found for branch: ${branchName}`);
            } else {
              throw new Error(
                `Multiple open PRs found for branch: ${branchName}`
              );
            }
          },
          3,
          2000
        );

        return prNumber;
      } catch (error) {
        console.log(`⚠️ GitHub API lookup failed, using fallback: ${error}`);
        return "local-dev";
      }
    }
  }

  console.log(
    "⚠️ Running in local development mode - no Vercel environment variables found"
  );
  return "local-dev";
}
