ALTER TABLE "draft" ADD COLUMN "source_text" text;--> statement-breakpoint
ALTER TABLE "draft" ADD COLUMN "laptop_only" boolean DEFAULT false NOT NULL;