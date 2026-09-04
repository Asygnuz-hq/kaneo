CREATE TABLE "activity_reaction" (
	"id" text PRIMARY KEY NOT NULL,
	"activity_id" text NOT NULL,
	"user_id" text NOT NULL,
	"emoji" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "activity_reaction_activity_user_emoji_unique" UNIQUE("activity_id","user_id","emoji")
);
--> statement-breakpoint
ALTER TABLE "activity_reaction" ADD CONSTRAINT "activity_reaction_activity_id_activity_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."activity"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "activity_reaction" ADD CONSTRAINT "activity_reaction_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "activity_reaction_activity_idx" ON "activity_reaction" USING btree ("activity_id");