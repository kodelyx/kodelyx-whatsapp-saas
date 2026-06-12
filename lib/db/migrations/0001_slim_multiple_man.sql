CREATE TABLE "auto_reply_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL,
	"instance_id" integer NOT NULL,
	"phone" varchar(50) NOT NULL,
	"last_sent_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "auto_reply_phone_instance_idx" UNIQUE("instance_id","phone")
);
--> statement-breakpoint
CREATE TABLE "auto_reply_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL,
	"instance_id" integer NOT NULL,
	"auto_reply_enabled" boolean DEFAULT false NOT NULL,
	"auto_reply_message" text DEFAULT 'Thank you for contacting us! We will get back to you shortly.',
	"auto_reply_delay_seconds" integer DEFAULT 300,
	"auto_reply_interval_hours" integer DEFAULT 12,
	"followup1_enabled" boolean DEFAULT false NOT NULL,
	"followup1_message" text DEFAULT '🔔 Reminder: Check our latest offers!',
	"followup1_delay_minutes" integer DEFAULT 480,
	"followup2_enabled" boolean DEFAULT false NOT NULL,
	"followup2_message" text DEFAULT '⏰ Last chance! This offer expires soon.',
	"followup2_delay_minutes" integer DEFAULT 720,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "auto_reply_instance_idx" UNIQUE("team_id","instance_id")
);
--> statement-breakpoint
CREATE TABLE "message_credit_transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL,
	"type" varchar(20) NOT NULL,
	"amount" integer NOT NULL,
	"description" text,
	"status" varchar(20) DEFAULT 'completed' NOT NULL,
	"utr" varchar(50),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "message_credits" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL,
	"balance" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "message_credits_team_id_idx" UNIQUE("team_id")
);
--> statement-breakpoint
CREATE TABLE "scheduled_followups" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL,
	"instance_id" integer NOT NULL,
	"phone" varchar(50) NOT NULL,
	"message" text NOT NULL,
	"scheduled_at" timestamp NOT NULL,
	"sent" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "call_credit_transactions" ADD COLUMN "status" varchar(20) DEFAULT 'completed' NOT NULL;--> statement-breakpoint
ALTER TABLE "call_credit_transactions" ADD COLUMN "utr" varchar(50);--> statement-breakpoint
ALTER TABLE "departments" ADD COLUMN "status" varchar(20) DEFAULT 'completed' NOT NULL;--> statement-breakpoint
ALTER TABLE "departments" ADD COLUMN "utr" varchar(50);--> statement-breakpoint
ALTER TABLE "plans" ADD COLUMN "status" varchar(20) DEFAULT 'completed' NOT NULL;--> statement-breakpoint
ALTER TABLE "plans" ADD COLUMN "utr" varchar(50);--> statement-breakpoint
ALTER TABLE "auto_reply_logs" ADD CONSTRAINT "auto_reply_logs_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auto_reply_logs" ADD CONSTRAINT "auto_reply_logs_instance_id_evolution_instances_id_fk" FOREIGN KEY ("instance_id") REFERENCES "public"."evolution_instances"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auto_reply_settings" ADD CONSTRAINT "auto_reply_settings_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auto_reply_settings" ADD CONSTRAINT "auto_reply_settings_instance_id_evolution_instances_id_fk" FOREIGN KEY ("instance_id") REFERENCES "public"."evolution_instances"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_credit_transactions" ADD CONSTRAINT "message_credit_transactions_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_credits" ADD CONSTRAINT "message_credits_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_followups" ADD CONSTRAINT "scheduled_followups_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_followups" ADD CONSTRAINT "scheduled_followups_instance_id_evolution_instances_id_fk" FOREIGN KEY ("instance_id") REFERENCES "public"."evolution_instances"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "msg_credit_tx_team_id_idx" ON "message_credit_transactions" USING btree ("team_id");