import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, message } = body;

    // Add your logic here (e.g., sending email, saving to database, etc.)
    console.log("Received contact form submission:", { email, message });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Failed to process contact form" },
      { status: 500 }
    );
  }
}
