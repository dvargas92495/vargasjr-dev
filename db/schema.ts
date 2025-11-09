import {
  boolean,
  jsonb,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { InboxMessageOperationTypes, InboxTypes, AppTypes } from "./constants";

export type InboxType = (typeof InboxTypes)[number];
export const InboxTypesEnum = pgEnum("inbox_type", InboxTypes);

export const AppTypesEnum = pgEnum("app_type", AppTypes);

export const InboxesTable = pgTable("inboxes", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name").notNull(),
  displayLabel: varchar("display_label"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  type: InboxTypesEnum("type").notNull(),
  config: jsonb("config").notNull(),
});

export type Inbox = typeof InboxesTable.$inferSelect;

export const InboxMessagesTable = pgTable("inbox_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  inboxId: uuid("inbox_id")
    .notNull()
    .references(() => InboxesTable.id),
  body: text("body").notNull(),
  threadId: varchar("thread_id"),
  externalId: varchar("external_id"),
  contactId: uuid("contact_id")
    .notNull()
    .references(() => ContactsTable.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  metadata: jsonb("metadata"),
});

export type InboxMessageOperationType =
  (typeof InboxMessageOperationTypes)[number];
/** Enum for inbox message operation types - includes READ, ARCHIVED, and UNREAD */
export const InboxMessageOperationTypesEnum = pgEnum(
  "inbox_message_operation_type",
  InboxMessageOperationTypes
);

export const InboxMessageOperationsTable = pgTable("inbox_message_operations", {
  id: uuid("id").primaryKey().defaultRandom(),
  inboxMessageId: uuid("inbox_message_id")
    .notNull()
    .references(() => InboxMessagesTable.id),
  operation: InboxMessageOperationTypesEnum("operation").notNull(),
  executionId: varchar("execution_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const ContactsTable = pgTable("contacts", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email"),
  phoneNumber: varchar("phone_number"),
  fullName: varchar("full_name"),
  slackId: varchar("slack_id"),
  slackDisplayName: varchar("slack_display_name"),
  supportsImessage: boolean("supports_imessage").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Contact = typeof ContactsTable.$inferSelect;

export const OutboxMessagesTable = pgTable("outbox_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  parentInboxMessageId: uuid("parent_inbox_message_id")
    .notNull()
    .references(() => InboxMessagesTable.id),
  contactId: uuid("contact_id").references(() => ContactsTable.id),
  bcc: varchar("bcc"),
  body: text("body").notNull(),
  threadId: varchar("thread_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  type: InboxTypesEnum("type").notNull(),
});

export const ApplicationsTable = pgTable("applications", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name").notNull(),
  appType: AppTypesEnum("app_type").notNull(),
  clientId: varchar("client_id"),
  clientSecret: varchar("client_secret"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Application = typeof ApplicationsTable.$inferSelect;

export const ApplicationWorkspacesTable = pgTable("application_workspaces", {
  id: uuid("id").primaryKey().defaultRandom(),
  applicationId: uuid("application_id")
    .notNull()
    .references(() => ApplicationsTable.id),
  name: varchar("name").notNull(),
  workspaceId: varchar("workspace_id"),
  clientId: varchar("client_id"),
  clientSecret: varchar("client_secret"),
  accessToken: varchar("access_token"),
  refreshToken: varchar("refresh_token"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type ApplicationWorkspace =
  typeof ApplicationWorkspacesTable.$inferSelect;

export const ChatSessionsTable = pgTable("chat_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  inboxId: uuid("inbox_id")
    .notNull()
    .references(() => InboxesTable.id),
  contactId: uuid("contact_id")
    .notNull()
    .references(() => ContactsTable.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type ChatSession = typeof ChatSessionsTable.$inferSelect;

export const RoutineJobsTable = pgTable("routine_jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name").notNull(),
  cronExpression: varchar("cron_expression").notNull(),
  enabled: boolean("enabled").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type RoutineJob = typeof RoutineJobsTable.$inferSelect;

export const JobsTable = pgTable("jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name").notNull(),
  description: text("description"),
  dueDate: timestamp("due_date").notNull(),
  priority: real("priority").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Job = typeof JobsTable.$inferSelect;

export const JobSessionsTable = pgTable("job_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  jobId: uuid("job_id")
    .notNull()
    .references(() => JobsTable.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  endAt: timestamp("end_at"),
});

export type JobSession = typeof JobSessionsTable.$inferSelect;

export const BlogPostsTable = pgTable("blog_posts", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: varchar("title").notNull(),
  content: text("content").notNull(),
  excerpt: text("excerpt"),
  publishedAt: timestamp("published_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type BlogPost = typeof BlogPostsTable.$inferSelect;

export const WebAuthnCredentialsTable = pgTable("webauthn_credentials", {
  id: uuid("id").primaryKey().defaultRandom(),
  credentialId: varchar("credential_id").notNull().unique(),
  publicKey: text("public_key").notNull(),
  counter: real("counter").notNull().default(0),
  userId: varchar("user_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
