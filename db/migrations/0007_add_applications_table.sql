CREATE TABLE "applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar NOT NULL,
	"client_id" varchar,
	"client_secret" varchar,
	"api_endpoint" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL
);
