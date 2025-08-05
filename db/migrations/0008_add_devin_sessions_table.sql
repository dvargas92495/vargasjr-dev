CREATE TABLE IF NOT EXISTS "devin_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" varchar NOT NULL,
	"issue_number" varchar NOT NULL,
	"chat_session_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "devin_sessions_session_id_unique" UNIQUE("session_id")
);

DO $$ BEGIN
 ALTER TABLE "devin_sessions" ADD CONSTRAINT "devin_sessions_chat_session_id_chat_sessions_id_fk" FOREIGN KEY ("chat_session_id") REFERENCES "public"."chat_sessions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
