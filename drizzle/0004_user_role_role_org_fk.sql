-- Ensure user_role.organization_id matches the role's organization_id

-- Allow composite FK by making (id, organization_id) unique on role
ALTER TABLE "role"
  ADD CONSTRAINT "role_id_org_unique" UNIQUE ("id", "organization_id");

-- Replace existing FK (role_id -> role.id) with composite FK (role_id, organization_id) -> (role.id, role.organization_id)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'user_role_role_id_role_id_fk'
      AND conrelid = 'user_role'::regclass
  ) THEN
    ALTER TABLE "user_role" DROP CONSTRAINT "user_role_role_id_role_id_fk";
  END IF;
END $$;

ALTER TABLE "user_role"
  ADD CONSTRAINT "user_role_role_org_fk"
  FOREIGN KEY ("role_id", "organization_id")
  REFERENCES "role" ("id", "organization_id")
  ON DELETE CASCADE
  ON UPDATE NO ACTION;
