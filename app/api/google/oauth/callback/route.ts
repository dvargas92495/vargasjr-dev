import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db/connection";
import { ApplicationsTable, ApplicationWorkspacesTable } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get("code");
    const state = searchParams.get("state"); // applicationId
    const error = searchParams.get("error");

    if (error) {
      return new NextResponse(
        `<html><body><script>window.close();</script><p>Authorization failed: ${error}</p></body></html>`,
        {
          status: 400,
          headers: { "Content-Type": "text/html" },
        }
      );
    }

    if (!code || !state) {
      return new NextResponse(
        `<html><body><script>window.close();</script><p>Missing authorization code or state</p></body></html>`,
        {
          status: 400,
          headers: { "Content-Type": "text/html" },
        }
      );
    }

    const applicationId = state;
    const db = getDb();

    const application = await db
      .select()
      .from(ApplicationsTable)
      .where(eq(ApplicationsTable.id, applicationId))
      .then((results) => results[0]);

    if (!application) {
      return new NextResponse(
        `<html><body><script>window.close();</script><p>Application not found</p></body></html>`,
        {
          status: 404,
          headers: { "Content-Type": "text/html" },
        }
      );
    }

    if (!application.clientId || !application.clientSecret) {
      return new NextResponse(
        `<html><body><script>window.close();</script><p>Application credentials not configured</p></body></html>`,
        {
          status: 400,
          headers: { "Content-Type": "text/html" },
        }
      );
    }

    const redirectUri = `${request.nextUrl.origin}/api/google/oauth/callback`;
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        code,
        client_id: application.clientId,
        client_secret: application.clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error("Token exchange failed:", errorData);
      return new NextResponse(
        `<html><body><script>window.close();</script><p>Failed to exchange authorization code for tokens</p></body></html>`,
        {
          status: 500,
          headers: { "Content-Type": "text/html" },
        }
      );
    }

    const tokenData = await tokenResponse.json();
    const { access_token, refresh_token } = tokenData;

    const existingWorkspace = await db
      .select()
      .from(ApplicationWorkspacesTable)
      .where(eq(ApplicationWorkspacesTable.applicationId, applicationId))
      .then((results) => results[0]);

    if (existingWorkspace) {
      await db
        .update(ApplicationWorkspacesTable)
        .set({
          accessToken: access_token,
          refreshToken: refresh_token || existingWorkspace.refreshToken,
        })
        .where(eq(ApplicationWorkspacesTable.id, existingWorkspace.id));
    } else {
      await db.insert(ApplicationWorkspacesTable).values({
        applicationId,
        name: `${application.name} Workspace`,
        accessToken: access_token,
        refreshToken: refresh_token,
      });
    }

    return new NextResponse(
      `<html><body><script>window.close();</script><p>Authorization successful! You can close this window.</p></body></html>`,
      {
        status: 200,
        headers: { "Content-Type": "text/html" },
      }
    );
  } catch (error) {
    console.error("OAuth callback error:", error);
    return new NextResponse(
      `<html><body><script>window.close();</script><p>An error occurred during authorization</p></body></html>`,
      {
        status: 500,
        headers: { "Content-Type": "text/html" },
      }
    );
  }
}
