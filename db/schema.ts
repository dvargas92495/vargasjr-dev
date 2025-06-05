import {
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { InboxMessageOperationTypes, InboxTypes } from "./constants";

export type InboxType = (typeof InboxTypes)[number];
export const InboxTypesEnum = pgEnum("inbox_type", InboxTypes);

export const InboxesTable = pgTable("inboxes", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name").notNull(),
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
  source: varchar("source").notNull(),
  body: text("body").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type InboxMessageOperationType =
  (typeof InboxMessageOperationTypes)[number];
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
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const ContactsTable = pgTable("contacts", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email"),
  phoneNumber: varchar("phone_number"),
  fullName: varchar("full_name"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Contact = typeof ContactsTable.$inferSelect;

export const OutboxMessagesTable = pgTable("outbox_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  parentInboxMessageId: uuid("parent_inbox_message_id")
    .notNull()
    .references(() => InboxMessagesTable.id),
  body: text("body").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  type: InboxTypesEnum("type").notNull(),
});

export const ApplicationsTable = pgTable("applications", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name").notNull(),
  clientId: varchar("client_id"),
  clientSecret: varchar("client_secret"),
  apiEndpoint: varchar("api_endpoint"),
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
  apiEndpoint: varchar("api_endpoint"),
  accessToken: varchar("access_token"),
  refreshToken: varchar("refresh_token"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type ApplicationWorkspace = typeof ApplicationWorkspacesTable.$inferSelect;

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
