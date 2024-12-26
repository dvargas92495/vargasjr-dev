CREATE TABLE "contact_form_responses" (
	"id" serial PRIMARY KEY NOT NULL,
	"form_id" varchar NOT NULL,
	"email" varchar NOT NULL,
	"message" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
