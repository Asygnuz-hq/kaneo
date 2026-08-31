DO $$ BEGIN
	IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_class WHERE relname = 'project_member' AND relkind = 'r') THEN
		CREATE TABLE "project_member" (
			"id" text PRIMARY KEY NOT NULL,
			"project_id" text NOT NULL,
			"user_id" text NOT NULL,
			"created_at" timestamp DEFAULT now() NOT NULL,
			CONSTRAINT "project_member_project_id_user_id_unique" UNIQUE("project_id","user_id")
		);
	END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
	IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'project_member_project_id_project_id_fk') THEN
		ALTER TABLE "project_member" ADD CONSTRAINT "project_member_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE cascade;
	END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
	IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'project_member_user_id_user_id_fk') THEN
		ALTER TABLE "project_member" ADD CONSTRAINT "project_member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
	END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "project_member_userId_idx" ON "project_member" USING btree ("user_id");
