CREATE TABLE "cook_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recipe_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"cooked_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cook_log" ADD CONSTRAINT "cook_log_recipe_id_recipe_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipe"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cook_log" ADD CONSTRAINT "cook_log_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cook_log_recipe_idx" ON "cook_log" USING btree ("recipe_id");--> statement-breakpoint
CREATE INDEX "cook_log_cooked_at_idx" ON "cook_log" USING btree ("cooked_at");