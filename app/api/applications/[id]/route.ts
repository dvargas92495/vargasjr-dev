import { NextResponse } from "next/server";
import { drizzle } from "drizzle-orm/vercel-postgres";
import { sql } from "@vercel/postgres";
import { ApplicationsTable } from "@/db/schema";
import { eq } from "drizzle-orm";

const db = drizzle(sql);

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id;

    // Query the database for the application with the given ID
    const applications = await db
      .select()
      .from(ApplicationsTable)
      .where(eq(ApplicationsTable.id, id))
      .limit(1);

    // Check if the application exists
    if (applications.length === 0) {
      return NextResponse.json(
        { error: "Application not found" },
        { status: 404 }
      );
    }

    const application = applications[0];

    // Parse the OAuth configuration if it exists
    if (application.oauthConfig) {
      try {
        // If oauthConfig is stored as a string, parse it
        if (typeof application.oauthConfig === "string") {
          application.oauthConfig = JSON.parse(application.oauthConfig);
        }
      } catch (error) {
        console.error("Error parsing OAuth config:", error);
      }
    }

    return NextResponse.json(application);
  } catch (error) {
    console.error("Error fetching application:", error);
    return NextResponse.json(
      { error: "Failed to fetch application" },
      { status: 500 }
    );
  }
}
