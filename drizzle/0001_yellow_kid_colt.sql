CREATE TABLE "ingredient_line" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recipe_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"quantity" numeric,
	"unit" text,
	"item" text NOT NULL,
	"note" text,
	"substitutes" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recipe" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"image_url" text,
	"servings" integer NOT NULL,
	"total_minutes" integer,
	"kcal_per_serving" integer,
	"source_url" text,
	"author_id" text NOT NULL,
	"updated_by_id" text,
	"steps" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"tips" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	CONSTRAINT "recipe_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "recipe_tag" (
	"recipe_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	CONSTRAINT "recipe_tag_recipe_id_tag_id_pk" PRIMARY KEY("recipe_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "tag" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"facet" text NOT NULL,
	"slug" text NOT NULL,
	"label" text NOT NULL,
	CONSTRAINT "tag_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "ingredient_line" ADD CONSTRAINT "ingredient_line_recipe_id_recipe_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipe"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe" ADD CONSTRAINT "recipe_author_id_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe" ADD CONSTRAINT "recipe_updated_by_id_user_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_tag" ADD CONSTRAINT "recipe_tag_recipe_id_recipe_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipe"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_tag" ADD CONSTRAINT "recipe_tag_tag_id_tag_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tag"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ingredient_line_recipe_idx" ON "ingredient_line" USING btree ("recipe_id");--> statement-breakpoint
CREATE INDEX "recipe_created_at_id_idx" ON "recipe" USING btree ("created_at","id");--> statement-breakpoint
CREATE INDEX "recipe_tag_tag_idx" ON "recipe_tag" USING btree ("tag_id");--> statement-breakpoint
CREATE INDEX "tag_facet_idx" ON "tag" USING btree ("facet");--> statement-breakpoint
-- A Recipe carries at most 5 Tags. Enforced here as well as in Zod and the picker,
-- because this is the only one of the three that cannot be bypassed.
CREATE OR REPLACE FUNCTION enforce_recipe_tag_limit() RETURNS trigger AS $$
BEGIN
  IF (SELECT count(*) FROM recipe_tag WHERE recipe_id = NEW.recipe_id) > 5 THEN
    RAISE EXCEPTION 'A Recipe may carry at most 5 Tags (recipe_id %)', NEW.recipe_id
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
DROP TRIGGER IF EXISTS recipe_tag_limit ON recipe_tag;
--> statement-breakpoint
CREATE TRIGGER recipe_tag_limit
  AFTER INSERT ON recipe_tag
  FOR EACH ROW EXECUTE FUNCTION enforce_recipe_tag_limit();
