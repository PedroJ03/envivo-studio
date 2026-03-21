CREATE TYPE "public"."source_system" AS ENUM('A', 'B');--> statement-breakpoint
CREATE TYPE "public"."source_status" AS ENUM('active', 'paused', 'error');--> statement-breakpoint
CREATE TABLE "ingestion_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(100) NOT NULL,
	"name" varchar(200) NOT NULL,
	"system" "source_system" NOT NULL,
	"connector_type" varchar(50) NOT NULL,
	"tenant_id" uuid REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action,
	"is_shared" boolean DEFAULT false NOT NULL,
	"config" jsonb DEFAULT '{}' NOT NULL,
	"schedule_cron" varchar(100),
	"priority" integer DEFAULT 1 NOT NULL,
	"rate_limit_rps" float,
	"status" "source_status" DEFAULT 'active' NOT NULL,
	"last_ingested_at" timestamp with time zone,
	"last_error" text,
	"error_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "ingestion_sources_slug_unique" ON "ingestion_sources" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "idx_ingestion_sources_system_status" ON "ingestion_sources" USING btree ("system", "status");--> statement-breakpoint
CREATE INDEX "idx_ingestion_sources_tenant_active" ON "ingestion_sources" USING btree ("tenant_id", "is_shared", "status");