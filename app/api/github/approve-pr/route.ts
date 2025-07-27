import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getGitHubAuthHeaders } from "../../../lib/github-auth";

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

    const githubRepo = "dvargas92495/vargasjr-dev";

    try {
      const headers = await getGitHubAuthHeaders();
      
      const response = await fetch(`https://api.github.com/repos/${githubRepo}/pulls/${prNumber}/reviews`, {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
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
    } catch (authError) {
      console.error('GitHub authentication error:', authError);
      return NextResponse.json(
        { error: "GitHub authentication failed" },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('PR approval error:', error);
    return NextResponse.json(
      { error: "PR approval failed" },
      { status: 500 }
    );
  }
}
