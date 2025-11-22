import { NextResponse } from "next/server";
import { ContactGithubReposTable, ContactsTable } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getDb } from "@/db/connection";
import { z } from "zod";

const LinkRepoSchema = z.object({
  repoOwner: z.string().min(1),
  repoName: z.string().min(1),
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = getDb();

    const contact = await db
      .select()
      .from(ContactsTable)
      .where(eq(ContactsTable.id, id))
      .then((results) => results[0]);

    if (!contact) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 });
    }

    const repos = await db
      .select()
      .from(ContactGithubReposTable)
      .where(eq(ContactGithubReposTable.contactId, id));

    return NextResponse.json({
      repos: repos.map((repo) => ({
        id: repo.id,
        repoOwner: repo.repoOwner,
        repoName: repo.repoName,
        createdAt: repo.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("Error fetching contact repos:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch contact repos",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = getDb();

    const contact = await db
      .select()
      .from(ContactsTable)
      .where(eq(ContactsTable.id, id))
      .then((results) => results[0]);

    if (!contact) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 });
    }

    const body = await request.json();
    const validatedData = LinkRepoSchema.parse(body);

    const existingRepo = await db
      .select()
      .from(ContactGithubReposTable)
      .where(
        and(
          eq(ContactGithubReposTable.contactId, id),
          eq(ContactGithubReposTable.repoOwner, validatedData.repoOwner),
          eq(ContactGithubReposTable.repoName, validatedData.repoName)
        )
      )
      .then((results) => results[0]);

    if (existingRepo) {
      return NextResponse.json(
        { error: "Repo already linked to this contact" },
        { status: 400 }
      );
    }

    const [newRepo] = await db
      .insert(ContactGithubReposTable)
      .values({
        contactId: id,
        repoOwner: validatedData.repoOwner,
        repoName: validatedData.repoName,
      })
      .returning();

    return NextResponse.json({
      repo: {
        id: newRepo.id,
        repoOwner: newRepo.repoOwner,
        repoName: newRepo.repoName,
        createdAt: newRepo.createdAt.toISOString(),
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.errors },
        { status: 400 }
      );
    }
    console.error("Error linking repo to contact:", error);
    return NextResponse.json(
      {
        error: "Failed to link repo to contact",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = getDb();
    const { searchParams } = new URL(request.url);
    const repoId = searchParams.get("repoId");

    if (!repoId) {
      return NextResponse.json(
        { error: "repoId query parameter is required" },
        { status: 400 }
      );
    }

    const contact = await db
      .select()
      .from(ContactsTable)
      .where(eq(ContactsTable.id, id))
      .then((results) => results[0]);

    if (!contact) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 });
    }

    const repo = await db
      .select()
      .from(ContactGithubReposTable)
      .where(
        and(
          eq(ContactGithubReposTable.id, repoId),
          eq(ContactGithubReposTable.contactId, id)
        )
      )
      .then((results) => results[0]);

    if (!repo) {
      return NextResponse.json(
        { error: "Repo not found or not linked to this contact" },
        { status: 404 }
      );
    }

    await db
      .delete(ContactGithubReposTable)
      .where(eq(ContactGithubReposTable.id, repoId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error unlinking repo from contact:", error);
    return NextResponse.json(
      {
        error: "Failed to unlink repo from contact",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
