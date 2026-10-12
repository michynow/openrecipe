ALTER TABLE "draft" ADD COLUMN "queued_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
-- Existing rows were queued when they were created, not when this column appeared.
UPDATE "draft" SET "queued_at" = "created_at";
