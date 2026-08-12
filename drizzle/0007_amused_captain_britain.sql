CREATE TABLE "proposal_reroll" (
	"user_id" text NOT NULL,
	"day" date NOT NULL,
	"n" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "proposal_reroll_user_id_day_pk" PRIMARY KEY("user_id","day")
);
--> statement-breakpoint
ALTER TABLE "proposal_reroll" ADD CONSTRAINT "proposal_reroll_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;