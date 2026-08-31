CREATE TABLE "client_account" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"password_hash" text,
	"invite_token_hash" text,
	"invite_token_expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "client_account_email_unique" UNIQUE("email"),
	CONSTRAINT "client_account_invite_token_hash_unique" UNIQUE("invite_token_hash")
);
--> statement-breakpoint
CREATE TABLE "client_project_access" (
	"id" text PRIMARY KEY NOT NULL,
	"client_account_id" text NOT NULL,
	"project_id" text NOT NULL,
	"invited_by_user_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "client_project_access_client_id_project_id_unique" UNIQUE("client_account_id","project_id")
);
--> statement-breakpoint
CREATE TABLE "client_session" (
	"id" text PRIMARY KEY NOT NULL,
	"client_account_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	CONSTRAINT "client_session_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
ALTER TABLE "client_project_access" ADD CONSTRAINT "client_project_access_client_account_id_client_account_id_fk" FOREIGN KEY ("client_account_id") REFERENCES "public"."client_account"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_project_access" ADD CONSTRAINT "client_project_access_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "client_project_access" ADD CONSTRAINT "client_project_access_invited_by_user_id_user_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_session" ADD CONSTRAINT "client_session_client_account_id_client_account_id_fk" FOREIGN KEY ("client_account_id") REFERENCES "public"."client_account"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "client_project_access_projectId_idx" ON "client_project_access" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "client_session_clientAccountId_idx" ON "client_session" USING btree ("client_account_id");