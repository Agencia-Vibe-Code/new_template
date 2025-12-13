/**
 * RBAC (Role-Based Access Control) utilities
 * 
 * This module provides functions to check user permissions within organizations.
 * It implements a hierarchical role system: owner > admin > member
 * 
 * Roles:
 * - owner: Full access to everything (bypasses all permission checks)
 * - admin: Most permissions except critical organization operations
 * - member: Default permissions + custom role permissions
 * 
 * Custom roles can be created per organization with specific permissions.
 */

import { eq, and, inArray } from "drizzle-orm";
import {
  organizationMembership,
  permission,
  rolePermission,
  role,
  userRole,
} from "./schema";
type DbType = typeof import("./db").db;

// Allow swapping the DB client in tests while keeping production code unchanged.
// Lazy import avoids requiring DB env vars during test/module load.
let dbClient: DbType | null = null;

async function getDb() {
  if (dbClient) return dbClient;
  const { db } = await import("./db");
  dbClient = db as DbType;
  return dbClient;
}

export function __setDbForTesting(mockDb: DbType) {
  dbClient = mockDb;
}

export function __resetDbForTesting() {
  dbClient = null;
}

/**
 * Default permissions for "member" role
 * These are the base permissions that all members have by default
 */
const DEFAULT_MEMBER_PERMISSIONS = [
  "project:read",
  "project:create",
  "user:read",
  "member:read",
] as const;

/**
 * Permissions that are restricted for admin role
 * Only owner can perform these actions
 */
const ADMIN_RESTRICTED_PERMISSIONS = [
  "organization:delete",
  "organization:transfer",
] as const;

/**
 * Role hierarchy levels
 * Higher number = more permissions
 */
const ROLE_HIERARCHY = {
  owner: 3,
  admin: 2,
  member: 1,
} as const;

type SystemRole = keyof typeof ROLE_HIERARCHY;

/**
 * Get default member permissions
 * These permissions are hardcoded and available to all members by default
 * 
 * @returns Array of permission names
 */
async function getDefaultMemberPermissions(): Promise<string[]> {
  // Return hardcoded list of default member permissions
  // These should match the permissions seeded in the database
  return [...DEFAULT_MEMBER_PERMISSIONS];
}

/**
 * Check if a user has a specific permission in an organization
 * 
 * @param userId - User ID
 * @param orgId - Organization ID
 * @param permissionName - Permission name (e.g., "project:create")
 * @returns true if user has permission, false otherwise
 */
export async function hasPermission(
  userId: string,
  orgId: string,
  permissionName: string
): Promise<boolean> {
  // 1. Get user's membership in the organization
  const db = await getDb();

  const membership = await db
    .select()
    .from(organizationMembership)
    .where(
      and(
        eq(organizationMembership.userId, userId),
        eq(organizationMembership.organizationId, orgId),
        eq(organizationMembership.status, "active")
      )
    )
    .limit(1);

  if (!membership[0]) {
    return false; // User is not a member of this organization
  }

  const membershipRole = membership[0].role as SystemRole;

  // 2. Owner has all permissions
  if (membershipRole === "owner") {
    return true;
  }

  // 3. Admin has most permissions, except some critical ones
  if (membershipRole === "admin") {
    return !ADMIN_RESTRICTED_PERMISSIONS.includes(
      permissionName as (typeof ADMIN_RESTRICTED_PERMISSIONS)[number]
    );
  }

  // 4. Get custom roles assigned to the user
  const userRoles = await db
    .select({ roleId: userRole.roleId })
    .from(userRole)
    .where(
      and(
        eq(userRole.userId, userId),
        eq(userRole.organizationId, orgId)
      )
    );

  const roleIds = userRoles.map((ur) => ur.roleId);

  // 5. If member without custom roles, check default member permissions
  if (membershipRole === "member" && roleIds.length === 0) {
    const memberPermissions = await getDefaultMemberPermissions();
    return memberPermissions.includes(permissionName);
  }

  // 6. Check permissions from custom roles
  if (roleIds.length > 0) {
    const hasPerm = await db
      .select()
      .from(rolePermission)
      .innerJoin(permission, eq(rolePermission.permissionId, permission.id))
      .innerJoin(role, eq(rolePermission.roleId, role.id))
      .where(
        and(
          inArray(rolePermission.roleId, roleIds),
          eq(role.organizationId, orgId),
          eq(permission.name, permissionName)
        )
      )
      .limit(1);

    if (hasPerm.length > 0) {
      return true;
    }
  }

  // 7. Also check default member permissions even if user has custom roles
  // (custom roles are additive, not replacing)
  if (membershipRole === "member") {
    const memberPermissions = await getDefaultMemberPermissions();
    if (memberPermissions.includes(permissionName)) {
      return true;
    }
  }

  return false;
}

/**
 * Require a permission, throwing an error if the user doesn't have it
 * 
 * @param userId - User ID
 * @param orgId - Organization ID
 * @param permissionName - Permission name
 * @throws Error if user doesn't have permission
 */
export async function requirePermission(
  userId: string,
  orgId: string,
  permissionName: string
): Promise<void> {
  const hasPerm = await hasPermission(userId, orgId, permissionName);
  if (!hasPerm) {
    throw new Error(`Permission denied: ${permissionName}`);
  }
}

/**
 * Check if a user has a specific role in an organization
 * 
 * @param userId - User ID
 * @param orgId - Organization ID
 * @param roleName - Role name (owner, admin, member)
 * @returns true if user has the role, false otherwise
 */
export async function hasRole(
  userId: string,
  orgId: string,
  roleName: SystemRole
): Promise<boolean> {
  const membership = await dbClient
    .select()
    .from(organizationMembership)
    .where(
      and(
        eq(organizationMembership.userId, userId),
        eq(organizationMembership.organizationId, orgId),
        eq(organizationMembership.status, "active"),
        eq(organizationMembership.role, roleName)
      )
    )
    .limit(1);

  return membership.length > 0;
}

/**
 * Require a specific role, throwing an error if the user doesn't have it
 * 
 * @param userId - User ID
 * @param orgId - Organization ID
 * @param roleName - Role name
 * @throws Error if user doesn't have the role
 */
export async function requireRole(
  userId: string,
  orgId: string,
  roleName: SystemRole
): Promise<void> {
  const hasRoleValue = await hasRole(userId, orgId, roleName);
  if (!hasRoleValue) {
    throw new Error(`Role required: ${roleName}`);
  }
}

/**
 * Check if a user has a role at or above a certain level
 * 
 * @param userId - User ID
 * @param orgId - Organization ID
 * @param minimumRole - Minimum role level required
 * @returns true if user has role at or above minimum level
 */
export async function hasMinimumRole(
  userId: string,
  orgId: string,
  minimumRole: SystemRole
): Promise<boolean> {
  const db = await getDb();
  const membership = await db
    .select()
    .from(organizationMembership)
    .where(
      and(
        eq(organizationMembership.userId, userId),
        eq(organizationMembership.organizationId, orgId),
        eq(organizationMembership.status, "active")
      )
    )
    .limit(1);

  if (!membership[0]) {
    return false;
  }

  const userRole = membership[0].role as SystemRole;
  const userRoleLevel = ROLE_HIERARCHY[userRole] || 0;
  const minimumLevel = ROLE_HIERARCHY[minimumRole];

  return userRoleLevel >= minimumLevel;
}

/**
 * Get user's role in an organization
 * 
 * @param userId - User ID
 * @param orgId - Organization ID
 * @returns User's role or null if not a member
 */
export async function getUserRole(
  userId: string,
  orgId: string
): Promise<SystemRole | null> {
  const db = await getDb();
  const membership = await db
    .select({ role: organizationMembership.role })
    .from(organizationMembership)
    .where(
      and(
        eq(organizationMembership.userId, userId),
        eq(organizationMembership.organizationId, orgId),
        eq(organizationMembership.status, "active")
      )
    )
    .limit(1);

  if (!membership[0]) {
    return null;
  }

  return membership[0].role as SystemRole;
}
