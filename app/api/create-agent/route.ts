import { NextResponse } from "next/server";
import { cookies } from "next/headers";

const PRODUCTION_AGENT_NAME = "main";

export async function POST() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("admin-token");

    if (token?.value !== process.env.ADMIN_TOKEN) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const response = await fetch(`https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}/actions/workflows/ci.yaml/dispatches`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ref: 'main',
        inputs: {
          agent_name: PRODUCTION_AGENT_NAME
        }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('GitHub API error:', errorText);
      return NextResponse.json(
        { error: "Failed to dispatch workflow" },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      success: true, 
      message: `Production agent creation workflow dispatched. This process will take several minutes.` 
    });

  } catch (error) {
    console.error('Agent creation error:', error);
    return NextResponse.json(
      { error: "Agent creation failed to start" },
      { status: 500 }
    );
  }
}
