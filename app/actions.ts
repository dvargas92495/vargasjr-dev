"use server";

import { revalidatePath } from "next/cache";
import { addInboxMessage } from "@/server";
import {
  ChatSessionsTable,
  ContactsTable,
  RoutineJobsTable,
  JobsTable,
  InboxMessagesTable,
  InboxMessageOperationsTable,
  OutboxMessagesTable,
} from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { getDb } from "@/db/connection";
import { convertPriorityToLabel } from "@/server";
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { AWS_S3_BUCKETS } from "@/app/lib/constants";
import { AWS_DEFAULT_REGION } from "@/server/constants";

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
      contactId: ChatSessionsTable.contactId,
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
    inboxName: "chat-sessions",
    threadId: sessionId,
    contactId: session.contactId,
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
    createdAt: routineJob.createdAt.toISOString(),
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

  const jobsWithLabels = jobs.map((job) => ({
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
    dueDate: job.dueDate.toISOString(),
  };
}

export async function deleteRoutineJob(id: string) {
  const db = getDb();
  const deletedRoutineJob = await db
    .delete(RoutineJobsTable)
    .where(eq(RoutineJobsTable.id, id))
    .returning()
    .execute();

  if (!deletedRoutineJob.length) {
    throw new Error("Routine job not found");
  }

  revalidatePath("/admin/jobs");
  return deletedRoutineJob[0];
}

export async function deleteContact(id: string) {
  const db = getDb();

  await db
    .delete(ChatSessionsTable)
    .where(eq(ChatSessionsTable.contactId, id))
    .execute();

  const deletedContact = await db
    .delete(ContactsTable)
    .where(eq(ContactsTable.id, id))
    .returning()
    .execute();

  if (!deletedContact.length) {
    throw new Error("Contact not found");
  }

  revalidatePath("/admin/crm");
  return deletedContact[0];
}

export async function updateContact(id: string, formData: FormData) {
  const fullName = formData.get("fullName") as string;
  const email = formData.get("email") as string;
  const phoneNumber = formData.get("phoneNumber") as string;
  const slackId = formData.get("slackId") as string;
  const slackDisplayName = formData.get("slackDisplayName") as string;

  const db = getDb();
  const updatedContact = await db
    .update(ContactsTable)
    .set({
      fullName: fullName || null,
      email: email || null,
      phoneNumber: phoneNumber || null,
      slackId: slackId || null,
      slackDisplayName: slackDisplayName || null,
    })
    .where(eq(ContactsTable.id, id))
    .returning()
    .execute();

  if (!updatedContact.length) {
    throw new Error("Contact not found");
  }

  revalidatePath("/admin/crm");
  revalidatePath(`/admin/crm/${id}`);
  return updatedContact[0];
}

export async function deleteMessage(messageId: string, inboxId: string) {
  const db = getDb();

  const message = await db
    .select({ externalId: InboxMessagesTable.externalId })
    .from(InboxMessagesTable)
    .where(eq(InboxMessagesTable.id, messageId))
    .limit(1);

  if (!message.length) {
    throw new Error("Message not found");
  }

  if (message[0].externalId) {
    try {
      const s3Client = new S3Client({
        region: AWS_DEFAULT_REGION,
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
        },
      });

      const deleteCommand = new DeleteObjectCommand({
        Bucket: AWS_S3_BUCKETS.INBOX,
        Key: message[0].externalId,
      });

      await s3Client.send(deleteCommand);
      console.log(`Deleted S3 object: ${message[0].externalId}`);
    } catch (error) {
      console.error(
        `Failed to delete S3 object ${message[0].externalId}:`,
        error
      );
    }
  }

  await db
    .delete(InboxMessageOperationsTable)
    .where(eq(InboxMessageOperationsTable.inboxMessageId, messageId))
    .execute();

  await db
    .delete(OutboxMessagesTable)
    .where(eq(OutboxMessagesTable.parentInboxMessageId, messageId))
    .execute();

  const deletedMessage = await db
    .delete(InboxMessagesTable)
    .where(eq(InboxMessagesTable.id, messageId))
    .returning()
    .execute();

  revalidatePath(`/admin/inboxes/${inboxId}`);
  return deletedMessage[0];
}

export async function markMessageAsUnread(messageId: string, inboxId: string) {
  const db = getDb();

  await db
    .delete(InboxMessageOperationsTable)
    .where(eq(InboxMessageOperationsTable.inboxMessageId, messageId))
    .execute();

  revalidatePath(`/admin/inboxes/${inboxId}/messages/${messageId}`);
  revalidatePath(`/admin/inboxes/${inboxId}`);
}

export async function mergeContact(currentContactId: string, targetContactId: string) {
  if (currentContactId === targetContactId) {
    throw new Error("Cannot merge a contact with itself");
  }

  const db = getDb();

  return await db.transaction(async (tx) => {
    const targetContact = await tx
      .select()
      .from(ContactsTable)
      .where(eq(ContactsTable.id, targetContactId))
      .limit(1);

    if (!targetContact.length) {
      throw new Error("Target contact not found");
    }

    const currentContact = await tx
      .select()
      .from(ContactsTable)
      .where(eq(ContactsTable.id, currentContactId))
      .limit(1);

    if (!currentContact.length) {
      throw new Error("Current contact not found");
    }

    await tx
      .update(InboxMessagesTable)
      .set({ contactId: currentContactId })
      .where(eq(InboxMessagesTable.contactId, targetContactId));

    await tx
      .update(ChatSessionsTable)
      .set({ contactId: currentContactId })
      .where(eq(ChatSessionsTable.contactId, targetContactId));

    const deletedContact = await tx
      .delete(ContactsTable)
      .where(eq(ContactsTable.id, targetContactId))
      .returning();

    if (!deletedContact.length) {
      throw new Error("Failed to delete target contact");
    }

    revalidatePath("/admin/crm");
    revalidatePath(`/admin/crm/${currentContactId}`);
    
    return deletedContact[0];
  });
}
