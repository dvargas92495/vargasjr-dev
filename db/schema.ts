import {
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

const InboxTypes = ["FORM", "EMAIL", "TEXT"] as const;

export type InboxType = (typeof InboxTypes)[number];
export const InboxTypesEnum = pgEnum("inbox_type", InboxTypes);

export const InboxesTable = pgTable("inboxes", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  type: InboxTypesEnum("type").notNull(),
  config: jsonb("config").notNull(),
});

export const InboxMessagesTable = pgTable("inbox_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  inboxId: uuid("inbox_id")
    .notNull()
    .references(() => InboxesTable.id),
  source: varchar("source").notNull(),
  body: text("body").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
