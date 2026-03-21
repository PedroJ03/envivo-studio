CREATE TYPE "public"."operator_role" AS ENUM('superadmin', 'admin', 'operator');--> statement-breakpoint
CREATE TABLE "operators" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"password_hash" text NOT NULL,
	"tenant_id" uuid,
	"role" "operator_role" DEFAULT 'operator' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "operators_email_unique" ON "operators" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_operators_email" ON "operators" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_operators_tenant" ON "operators" USING btree ("tenant_id");--> statement-breakpoint
ALTER TABLE "operators" ADD CONSTRAINT "operators_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;