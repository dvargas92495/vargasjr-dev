CREATE TYPE "public"."inbox_message_operation_type" AS ENUM('READ', 'ARCHIVED');--> statement-breakpoint
CREATE TABLE "inbox_message_operations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"inbox_message_id" uuid NOT NULL,
	"operation" "inbox_message_operation_type" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "inbox_message_operations" ADD CONSTRAINT "inbox_message_operations_inbox_message_id_inbox_messages_id_fk" FOREIGN KEY ("inbox_message_id") REFERENCES "public"."inbox_messages"("id") ON DELETE no action ON UPDATE no action;