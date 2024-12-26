import { pgTable, serial, text, timestamp, varchar } from "drizzle-orm/pg-core";

export const ContactFormResponsesTable = pgTable("contact_form_responses", {
  id: serial("id").primaryKey(),
  formId: varchar("form_id").notNull(),
  email: varchar("email").notNull(),
  message: text("message").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
