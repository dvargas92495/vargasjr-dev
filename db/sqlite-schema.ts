import {
  integer,
  real,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";
import { InboxMessageOperationTypes, InboxTypes } from "./constants";
import { randomUUID } from "crypto";

export type InboxType = (typeof InboxTypes)[number];
export type InboxMessageOperationType = (typeof InboxMessageOperationTypes)[number];

export const InboxesTable = sqliteTable("inboxes", {
  id: text("id").primaryKey().$defaultFn(() => randomUUID()),
  name: text("name").notNull(),
  createdAt: integer("created_at", { mode: 'timestamp_ms' }).notNull().$defaultFn(() => new Date()),
  type: text("type").notNull(),
  config: text("config").notNull(),
});

export type Inbox = typeof InboxesTable.$inferSelect;

export const InboxMessagesTable = sqliteTable("inbox_messages", {
  id: text("id").primaryKey().$defaultFn(() => randomUUID()),
  inboxId: text("inbox_id")
    .notNull()
    .references(() => InboxesTable.id),
  source: text("source").notNull(),
  body: text("body").notNull(),
  threadId: text("thread_id"),
  createdAt: integer("created_at", { mode: 'timestamp_ms' }).notNull().$defaultFn(() => new Date()),
});

export const InboxMessageOperationsTable = sqliteTable("inbox_message_operations", {
  id: text("id").primaryKey().$defaultFn(() => randomUUID()),
  inboxMessageId: text("inbox_message_id")
    .notNull()
    .references(() => InboxMessagesTable.id),
  operation: text("operation").notNull(),
  createdAt: integer("created_at", { mode: 'timestamp_ms' }).notNull().$defaultFn(() => new Date()),
});

export const ContactsTable = sqliteTable("contacts", {
  id: text("id").primaryKey().$defaultFn(() => randomUUID()),
  email: text("email"),
  phoneNumber: text("phone_number"),
  fullName: text("full_name"),
  createdAt: integer("created_at", { mode: 'timestamp_ms' }).notNull().$defaultFn(() => new Date()),
});

export type Contact = typeof ContactsTable.$inferSelect;

export const OutboxMessagesTable = sqliteTable("outbox_messages", {
  id: text("id").primaryKey().$defaultFn(() => randomUUID()),
  parentInboxMessageId: text("parent_inbox_message_id")
    .notNull()
    .references(() => InboxMessagesTable.id),
  body: text("body").notNull(),
  threadId: text("thread_id"),
  createdAt: integer("created_at", { mode: 'timestamp_ms' }).notNull().$defaultFn(() => new Date()),
  type: text("type").notNull(),
});

export const ApplicationsTable = sqliteTable("applications", {
  id: text("id").primaryKey().$defaultFn(() => randomUUID()),
  name: text("name").notNull(),
  clientId: text("client_id"),
  clientSecret: text("client_secret"),
  createdAt: integer("created_at", { mode: 'timestamp_ms' }).notNull().$defaultFn(() => new Date()),
});

export type Application = typeof ApplicationsTable.$inferSelect;

export const ApplicationWorkspacesTable = sqliteTable("application_workspaces", {
  id: text("id").primaryKey().$defaultFn(() => randomUUID()),
  applicationId: text("application_id")
    .notNull()
    .references(() => ApplicationsTable.id),
  name: text("name").notNull(),
  workspaceId: text("workspace_id"),
  clientId: text("client_id"),
  clientSecret: text("client_secret"),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  createdAt: integer("created_at", { mode: 'timestamp_ms' }).notNull().$defaultFn(() => new Date()),
});

export type ApplicationWorkspace = typeof ApplicationWorkspacesTable.$inferSelect;

export const ChatSessionsTable = sqliteTable("chat_sessions", {
  id: text("id").primaryKey().$defaultFn(() => randomUUID()),
  inboxId: text("inbox_id")
    .notNull()
    .references(() => InboxesTable.id),
  contactId: text("contact_id")
    .notNull()
    .references(() => ContactsTable.id),
  createdAt: integer("created_at", { mode: 'timestamp_ms' }).notNull().$defaultFn(() => new Date()),
});

export type ChatSession = typeof ChatSessionsTable.$inferSelect;

export const RoutineJobsTable = sqliteTable("routine_jobs", {
  id: text("id").primaryKey().$defaultFn(() => randomUUID()),
  name: text("name").notNull(),
  cronExpression: text("cron_expression").notNull(),
  enabled: integer("enabled", { mode: 'boolean' }).default(true).notNull(),
  createdAt: integer("created_at", { mode: 'timestamp_ms' }).notNull().$defaultFn(() => new Date()),
});

export type RoutineJob = typeof RoutineJobsTable.$inferSelect;

export const JobsTable = sqliteTable("jobs", {
  id: text("id").primaryKey().$defaultFn(() => randomUUID()),
  name: text("name").notNull(),
  description: text("description"),
  dueDate: integer("due_date", { mode: 'timestamp_ms' }).notNull(),
  priority: real("priority").notNull(),
  createdAt: integer("created_at", { mode: 'timestamp_ms' }).notNull().$defaultFn(() => new Date()),
});

export type Job = typeof JobsTable.$inferSelect;

export const JobSessionsTable = sqliteTable("job_sessions", {
  id: text("id").primaryKey().$defaultFn(() => randomUUID()),
  jobId: text("job_id")
    .notNull()
    .references(() => JobsTable.id),
  createdAt: integer("created_at", { mode: 'timestamp_ms' }).notNull().$defaultFn(() => new Date()),
  endAt: integer("end_at", { mode: 'timestamp_ms' }),
});

export type JobSession = typeof JobSessionsTable.$inferSelect;
