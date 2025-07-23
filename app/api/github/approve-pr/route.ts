import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("admin-token");

    if (token?.value !== process.env.ADMIN_TOKEN) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { prNumber } = await request.json();

    if (!prNumber) {
      return NextResponse.json({ error: "PR number is required" }, { status: 400 });
    }

    const githubToken = process.env.GITHUB_TOKEN;
    const githubRepo = process.env.GITHUB_REPOSITORY;

    if (!githubToken) {
      return NextResponse.json({ error: "GitHub token not configured" }, { status: 500 });
    }

    if (!githubRepo) {
      return NextResponse.json({ error: "GitHub repository not configured" }, { status: 500 });
    }

    const response = await fetch(`https://api.github.com/repos/${githubRepo}/pulls/${prNumber}/reviews`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${githubToken}`,
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2022-11-28'
      },
      body: JSON.stringify({
        event: 'APPROVE'
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('GitHub API error:', errorText);
      return NextResponse.json(
        { error: "Failed to approve PR" },
        { status: response.status }
      );
    }

    return NextResponse.json({ 
      success: true, 
      message: `PR #${prNumber} approved successfully` 
    });

  } catch (error) {
    console.error('PR approval error:', error);
    return NextResponse.json(
      { error: "PR approval failed" },
      { status: 500 }
    );
  }
}
