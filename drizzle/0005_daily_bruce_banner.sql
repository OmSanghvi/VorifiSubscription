CREATE TABLE IF NOT EXISTS "ai_responses" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" varchar NOT NULL,
	"responseText" text NOT NULL,
	"createdAt" timestamp DEFAULT now()
);
