ALTER TABLE "public"."inboxes" ALTER COLUMN "type" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "public"."outbox_messages" ALTER COLUMN "type" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."inbox_type";--> statement-breakpoint
CREATE TYPE "public"."inbox_type" AS ENUM('FORM', 'EMAIL', 'SMS', 'NONE');--> statement-breakpoint
ALTER TABLE "public"."inboxes" ALTER COLUMN "type" SET DATA TYPE "public"."inbox_type" USING "type"::"public"."inbox_type";--> statement-breakpoint
ALTER TABLE "public"."outbox_messages" ALTER COLUMN "type" SET DATA TYPE "public"."inbox_type" USING "type"::"public"."inbox_type";