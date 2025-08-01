"use server";

import { revalidatePath } from "next/cache";
import { addInboxMessage } from "@/server";
import { ChatSessionsTable, ContactsTable, RoutineJobsTable, JobsTable } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { getDb } from "@/db/connection";
import { convertPriorityToLabel } from "@/server";

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

  await addInboxMessage({
    body: message.trim(),
    source: session.contactEmail || "Anonymous",
    inboxName: "chat-sessions",
    threadId: sessionId,
  });

  revalidatePath(`/chat/${sessionId}`);
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
