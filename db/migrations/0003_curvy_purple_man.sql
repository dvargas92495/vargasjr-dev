CREATE TABLE "contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar,
	"phone_number" varchar,
	"full_name" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL
);
