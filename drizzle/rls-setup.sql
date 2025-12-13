-- ============================================
-- Row-Level Security (RLS) Setup
-- ============================================
-- This script configures RLS policies for multi-tenant isolation
-- Run this AFTER running the migrations
-- ============================================

-- Create schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS app;

-- Helper function to get current organization ID from session context
-- Returns NULL if not set (handles empty strings and NULL)
CREATE OR REPLACE FUNCTION app.current_org_id() 
RETURNS TEXT AS $$
  SELECT NULLIF(current_setting('app.current_org_id', true), '');
$$ LANGUAGE sql STABLE;

-- Helper function to get current user ID from session context
-- Returns NULL if not set (handles empty strings and NULL)
CREATE OR REPLACE FUNCTION app.current_user_id() 
RETURNS TEXT AS $$
  SELECT NULLIF(current_setting('app.user_id', true), '');
$$ LANGUAGE sql STABLE;

-- Enable RLS on all tenant-scoped tables
ALTER TABLE organization ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_membership ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_invitation ENABLE ROW LEVEL SECURITY;
ALTER TABLE role ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permission ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_role ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS Policies
-- ============================================

-- Policy for organization_membership
-- Users can only see memberships for organizations they belong to
-- or their own memberships
-- Note: Explicitly checks that context is set before comparing
DROP POLICY IF EXISTS org_membership_isolation ON organization_membership;
CREATE POLICY org_membership_isolation ON organization_membership
  FOR ALL
  USING (
    (app.current_org_id() IS NOT NULL AND 
     organization_id::text = app.current_org_id()) OR
    (app.current_user_id() IS NOT NULL AND 
     user_id::text = app.current_user_id())
  );

-- Policy for organization
-- Users can only see organizations they are members of
-- Note: Explicitly checks that context is set before comparing
DROP POLICY IF EXISTS org_isolation ON organization;
CREATE POLICY org_isolation ON organization
  FOR SELECT
  USING (
    app.current_user_id() IS NOT NULL AND
    id::text IN (
      SELECT organization_id FROM organization_membership 
      WHERE user_id::text = app.current_user_id()
        AND status = 'active'
    )
  );

-- Policy for organization_invitation
-- Users can see invitations if:
-- 1. They are active members of the organization (with appropriate role to view invitations)
-- 2. The invitation was sent to their email AND has not been accepted yet
DROP POLICY IF EXISTS org_invitation_isolation ON organization_invitation;
CREATE POLICY org_invitation_isolation ON organization_invitation
  FOR SELECT
  USING (
    -- Members of the organization can see invitations
    (app.current_org_id() IS NOT NULL AND 
     app.current_user_id() IS NOT NULL AND
     organization_id::text = app.current_org_id() AND
     organization_id IN (
       SELECT organization_id FROM organization_membership 
       WHERE user_id::text = app.current_user_id() 
         AND status = 'active'
     )) OR
    -- Users can see their own pending invitations
    (app.current_user_id() IS NOT NULL AND
     email = (SELECT email FROM "user" WHERE id::text = app.current_user_id()) 
     AND accepted_at IS NULL)
  );

-- Policy for role
-- Users can only see roles for organizations they belong to
-- Note: Explicitly checks that context is set before comparing
DROP POLICY IF EXISTS role_isolation ON role;
CREATE POLICY role_isolation ON role
  FOR SELECT
  USING (
    app.current_org_id() IS NOT NULL AND
    organization_id::text = app.current_org_id()
  );

-- Policy for role_permission
-- Users can only see role permissions for roles in their organization
-- Note: Explicitly checks that context is set before comparing
DROP POLICY IF EXISTS role_permission_isolation ON role_permission;
CREATE POLICY role_permission_isolation ON role_permission
  FOR SELECT
  USING (
    app.current_org_id() IS NOT NULL AND
    role_id IN (
      SELECT id FROM role 
      WHERE organization_id::text = app.current_org_id()
    )
  );

-- Policy for user_role
-- Users can only see user roles for their organization
-- Note: Explicitly checks that context is set before comparing
DROP POLICY IF EXISTS user_role_isolation ON user_role;
CREATE POLICY user_role_isolation ON user_role
  FOR SELECT
  USING (
    app.current_org_id() IS NOT NULL AND
    organization_id::text = app.current_org_id()
  );

-- ============================================
-- Notes
-- ============================================
-- IMPORTANT: These RLS policies are an ADDITIONAL security layer.
-- Always use explicit filters in application code (e.g., WHERE organization_id = ?)
-- RLS should never be the only security mechanism.
--
-- To use RLS context in transactions:
--   SET LOCAL app.current_org_id = 'org-id';
--   SET LOCAL app.user_id = 'user-id';
--
-- Or use the withOrgContext helper function in src/lib/db-context.ts

