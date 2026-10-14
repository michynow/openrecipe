CREATE TABLE "shopping_list_entry" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recipe_id" uuid NOT NULL,
	"servings" integer NOT NULL,
	"excluded" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"added_by_id" text,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shopping_list_entry_recipe_id_unique" UNIQUE("recipe_id")
);
--> statement-breakpoint
CREATE TABLE "shopping_list_tick" (
	"key" text PRIMARY KEY NOT NULL,
	"quantity" numeric,
	"ticked_by_id" text,
	"ticked_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ingredient_line" ADD COLUMN "section" text;--> statement-breakpoint
ALTER TABLE "shopping_list_entry" ADD CONSTRAINT "shopping_list_entry_recipe_id_recipe_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipe"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopping_list_entry" ADD CONSTRAINT "shopping_list_entry_added_by_id_user_id_fk" FOREIGN KEY ("added_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopping_list_tick" ADD CONSTRAINT "shopping_list_tick_ticked_by_id_user_id_fk" FOREIGN KEY ("ticked_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;