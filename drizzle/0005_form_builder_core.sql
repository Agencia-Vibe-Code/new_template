-- Normalize membership roles to the new uppercase convention
UPDATE "organization_membership"
SET "role" = UPPER("role");

-- Default role is AGENT for new members
ALTER TABLE "organization_membership"
  ALTER COLUMN "role" SET DEFAULT 'AGENT';

-- Form templates per tenant
CREATE TABLE IF NOT EXISTS "form_template" (
  "id" text PRIMARY KEY,
  "tenant_id" text NOT NULL REFERENCES "organization"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "status" text NOT NULL DEFAULT 'draft',
  "schema_json" jsonb NOT NULL,
  "pdf_template_file_ref" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  "published_at" timestamp
);

CREATE INDEX IF NOT EXISTS "form_template_tenant_idx"
  ON "form_template" ("tenant_id");

CREATE UNIQUE INDEX IF NOT EXISTS "form_template_tenant_name_unique"
  ON "form_template" ("tenant_id", "name");

-- PDF coordinate mapping (per template)
CREATE TABLE IF NOT EXISTS "pdf_field_map" (
  "id" text PRIMARY KEY,
  "template_id" text NOT NULL REFERENCES "form_template"("id") ON DELETE CASCADE,
  "field_key" text NOT NULL,
  "page" integer NOT NULL DEFAULT 1,
  "x" double precision NOT NULL,
  "y" double precision NOT NULL,
  "font_size" double precision NOT NULL DEFAULT 10,
  "font_name" text NOT NULL DEFAULT 'Helvetica',
  "align" text NOT NULL DEFAULT 'left',
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "pdf_field_map_template_idx"
  ON "pdf_field_map" ("template_id");

CREATE UNIQUE INDEX IF NOT EXISTS "pdf_field_map_template_field_unique"
  ON "pdf_field_map" ("template_id", "field_key");

-- Form submissions
CREATE TABLE IF NOT EXISTS "submission" (
  "id" text PRIMARY KEY,
  "tenant_id" text NOT NULL REFERENCES "organization"("id") ON DELETE CASCADE,
  "template_id" text NOT NULL REFERENCES "form_template"("id") ON DELETE CASCADE,
  "created_by" text NOT NULL REFERENCES "user"("id") ON DELETE SET NULL,
  "data_json" jsonb NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "submission_tenant_idx"
  ON "submission" ("tenant_id");

CREATE INDEX IF NOT EXISTS "submission_template_idx"
  ON "submission" ("template_id");

-- PDF export audit log
CREATE TABLE IF NOT EXISTS "export_log" (
  "id" text PRIMARY KEY,
  "tenant_id" text NOT NULL REFERENCES "organization"("id") ON DELETE CASCADE,
  "submission_id" text NOT NULL REFERENCES "submission"("id") ON DELETE CASCADE,
  "exported_by" text NOT NULL REFERENCES "user"("id") ON DELETE SET NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "export_log_tenant_idx"
  ON "export_log" ("tenant_id");

CREATE INDEX IF NOT EXISTS "export_log_submission_idx"
  ON "export_log" ("submission_id");
