"use server";

import { revalidatePath } from "next/cache";
import { addInboxMessage } from "@/server";
import { ChatSessionsTable, ContactsTable, RoutineJobsTable, JobsTable, DevinSessionsTable } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { getDb } from "@/db/connection";
import { convertPriorityToLabel } from "@/server";
import { getGitHubAuthHeaders } from "@/app/lib/github-auth";
import { VargasJRAgentCleanup } from "@/scripts/cleanup-pr";

export async function sendChatMessage(sessionId: string, formData: FormData) {
  const message = formData.get("message") as string;
  
  if (!message || message.trim().length === 0) {
    throw new Error("Message cannot be empty");
  }

  const db = getDb();
  const chatSession = await db
    .select({
      id: ChatSessionsTable.id,
      contactEmail: ContactsTable.email,
    })
    .from(ChatSessionsTable)
    .innerJoin(ContactsTable, eq(ChatSessionsTable.contactId, ContactsTable.id))
    .where(eq(ChatSessionsTable.id, sessionId))
    .limit(1);

  if (!chatSession.length) {
    throw new Error("Chat session not found");
  }

  const session = chatSession[0];

  if (message.trim().toLowerCase() === 'archive') {
    await handleArchiveMessage(sessionId);
    return;
  }

  await addInboxMessage({
    body: message.trim(),
    source: session.contactEmail || "Anonymous",
    inboxName: "chat-sessions",
    threadId: sessionId,
  });

  revalidatePath(`/chat/${sessionId}`);
}

async function handleArchiveMessage(chatSessionId: string) {
  const db = getDb();
  
  const devinSession = await db
    .select()
    .from(DevinSessionsTable)
    .where(eq(DevinSessionsTable.chatSessionId, chatSessionId))
    .limit(1);

  if (!devinSession.length) {
    console.log(`No Devin session found for chat session ${chatSessionId}`);
    return;
  }

  const issueNumber = devinSession[0].issueNumber;
  
  const prNumber = await findPRForIssue(issueNumber);
  
  if (prNumber) {
    console.log(`Triggering cleanup for PR #${prNumber} (issue #${issueNumber})`);
    await triggerCleanup(prNumber);
  } else {
    console.log(`No PR found for issue #${issueNumber}, skipping cleanup`);
  }
}

async function findPRForIssue(issueNumber: string): Promise<string | null> {
  try {
    const headers = await getGitHubAuthHeaders();
    const response = await fetch(
      `https://api.github.com/repos/dvargas92495/vargasjr-dev/pulls?state=all&sort=created&direction=desc`,
      { headers }
    );
    
    if (!response.ok) return null;
    
    const prs = await response.json();
    const pr = prs.find((pr: { body?: string; title: string; number: number }) => 
      pr.body && pr.body.includes(`closes #${issueNumber}`) ||
      pr.body && pr.body.includes(`fixes #${issueNumber}`) ||
      pr.title.includes(`#${issueNumber}`)
    );
    
    return pr ? pr.number.toString() : null;
  } catch (error) {
    console.error('Error finding PR for issue:', error);
    return null;
  }
}

async function triggerCleanup(prNumber: string) {
  try {
    const cleanup = new VargasJRAgentCleanup({ prNumber });
    await cleanup.cleanupAgent();
    console.log(`✅ Cleanup completed for PR #${prNumber}`);
  } catch (error) {
    console.error(`❌ Cleanup failed for PR #${prNumber}:`, error);
  }
}

export async function getRoutineJob(id: string) {
  const db = getDb();
  const routineJob = await db
    .select()
    .from(RoutineJobsTable)
    .where(eq(RoutineJobsTable.id, id))
    .then((results) => results[0]);

  if (!routineJob) {
    throw new Error("Routine job not found");
  }

  return {
    ...routineJob,
    createdAt: routineJob.createdAt.toISOString()
  };
}


export async function getJobs() {
  const db = getDb();
  const jobs = await db
    .select({
      id: JobsTable.id,
      name: JobsTable.name,
      dueDate: JobsTable.dueDate,
      priority: JobsTable.priority,
      createdAt: JobsTable.createdAt,
    })
    .from(JobsTable)
    .orderBy(desc(JobsTable.priority));

  const jobsWithLabels = jobs.map(job => ({
    ...job,
    priority: convertPriorityToLabel(job.priority),
  }));

  return jobsWithLabels;
}

export async function createJob(formData: FormData) {
  const name = formData.get("name") as string;
  const description = formData.get("description") as string;
  const dueDate = formData.get("dueDate") as string;
  const priority = parseFloat(formData.get("priority") as string);

  if (!name || !dueDate || isNaN(priority)) {
    throw new Error("Name, due date, and priority are required");
  }

  const db = getDb();
  const newJob = await db
    .insert(JobsTable)
    .values({
      name,
      description: description || null,
      dueDate: new Date(dueDate),
      priority,
    })
    .returning()
    .execute();

  revalidatePath("/admin/jobs");
  return newJob[0];
}

export async function updateJob(id: string, formData: FormData) {
  const name = formData.get("name") as string;
  const description = formData.get("description") as string;
  const dueDate = formData.get("dueDate") as string;
  const priority = parseFloat(formData.get("priority") as string);

  if (!name || !dueDate || isNaN(priority)) {
    throw new Error("Name, due date, and priority are required");
  }

  const db = getDb();
  const updatedJob = await db
    .update(JobsTable)
    .set({
      name,
      description: description || null,
      dueDate: new Date(dueDate),
      priority,
    })
    .where(eq(JobsTable.id, id))
    .returning()
    .execute();

  if (!updatedJob.length) {
    throw new Error("Job not found");
  }

  revalidatePath("/admin/jobs");
  return updatedJob[0];
}

export async function deleteJob(id: string) {
  const db = getDb();
  const deletedJob = await db
    .delete(JobsTable)
    .where(eq(JobsTable.id, id))
    .returning()
    .execute();

  if (!deletedJob.length) {
    throw new Error("Job not found");
  }

  revalidatePath("/admin/jobs");
  return deletedJob[0];
}

export async function getJob(id: string) {
  const db = getDb();
  const job = await db
    .select()
    .from(JobsTable)
    .where(eq(JobsTable.id, id))
    .then((results) => results[0]);

  if (!job) {
    throw new Error("Job not found");
  }

  return {
    ...job,
    priority: convertPriorityToLabel(job.priority),
    createdAt: job.createdAt.toISOString(),
    dueDate: job.dueDate.toISOString()
  };
}
