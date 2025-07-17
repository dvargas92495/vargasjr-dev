"use server";

import { revalidatePath } from "next/cache";
import { addInboxMessage } from "@/server";
import { ChatSessionsTable, ContactsTable, RoutineJobsTable } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/connection";
import { VellumClient } from 'vellum-ai';

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

export async function testRoutineJobWorkflow(id: string) {
  const db = getDb();
  const routineJob = await db
    .select()
    .from(RoutineJobsTable)
    .where(eq(RoutineJobsTable.id, id))
    .then((results) => results[0]);

  if (!routineJob) {
    throw new Error("Routine job not found");
  }

  const apiKey = process.env.VELLUM_API_KEY;
  if (!apiKey) {
    throw new Error("VELLUM_API_KEY environment variable is required");
  }

  const vellumClient = new VellumClient({
    apiKey: apiKey,
  });

  const result = await vellumClient.executeWorkflow({
    workflowDeploymentName: routineJob.name,
    inputs: [],
  });

  return {
    success: true,
    outputs: result.data || null,
    message: `Workflow ${routineJob.name} executed successfully`
  };
}
