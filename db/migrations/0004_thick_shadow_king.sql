CREATE TABLE "outbox_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parent_inbox_message_id" uuid NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"type" "inbox_type" NOT NULL
);
--> statement-breakpoint
ALTER TABLE "outbox_messages" ADD CONSTRAINT "outbox_messages_parent_inbox_message_id_inbox_messages_id_fk" FOREIGN KEY ("parent_inbox_message_id") REFERENCES "public"."inbox_messages"("id") ON DELETE no action ON UPDATE no action;