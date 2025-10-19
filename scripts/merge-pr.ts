#!/usr/bin/env node

import "dotenv/config";
import { getGitHubAuthHeaders } from "../app/lib/github-auth";
import { GITHUB_REPOSITORY } from "../app/lib/constants";

async function mergePR() {
  const prNumber = process.argv[2];

  if (!prNumber) {
    console.error("Usage: npm run merge -- <pr_number>");
    process.exit(1);
  }

  const repo = GITHUB_REPOSITORY;

  try {
    console.log(`Merging PR #${prNumber} in ${repo}...`);

    const headers = await getGitHubAuthHeaders();

    const response = await fetch(
      `https://api.github.com/repos/${repo}/pulls/${prNumber}/merge`,
      {
        method: "PUT",
        headers: {
          ...headers,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          merge_method: "squash",
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Failed to merge PR: ${response.status} ${errorText}`);
      process.exit(1);
    }

    const result = await response.json();
    console.log(`✅ PR #${prNumber} merged successfully!`);
    console.log(`Merge SHA: ${result.sha}`);
    console.log(`Message: ${result.message}`);
  } catch (error) {
    console.error("Error merging PR:", error);
    process.exit(1);
  }
}

mergePR();
