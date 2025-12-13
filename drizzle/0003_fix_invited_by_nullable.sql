-- Make organization_invitation.invited_by nullable to match ON DELETE SET NULL
ALTER TABLE "organization_invitation"
  ALTER COLUMN "invited_by" DROP NOT NULL;
