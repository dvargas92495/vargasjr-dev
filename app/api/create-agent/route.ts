import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { cookies } from "next/headers";
import { spawn } from "child_process";

const createAgentSchema = z.object({
  name: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("admin-token");

    if (token?.value !== process.env.ADMIN_TOKEN) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name } = createAgentSchema.parse(body);
    
    const createProcess = spawn('npm', ['run', 'create-agent', name], {
      detached: true,
      stdio: 'ignore'
    });
    
    createProcess.unref();
    
    return NextResponse.json({ 
      success: true, 
      message: `Agent creation started for: ${name}. This process will take several minutes.` 
    });

  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Agent creation failed to start" },
      { status: 500 }
    );
  }
}
