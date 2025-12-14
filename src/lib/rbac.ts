/**
 * RBAC (Role-Based Access Control) utilities
 * 
 * This module provides functions to check user permissions within organizations.
 * It implements a hierarchical role system for the Roteiro de Visita builder:
 * OWNER > ADMIN > MANAGER > AGENT
 *
 * The application also supports custom roles through the `role` + `user_role`
 * tables. System roles are resolved from organization_membership.role while
 * custom role grants are additive via user_role + role_permission.
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
 * Permission catalog for the project.
 * These are persisted in the `permission` table via scripts/seed-permissions.ts
 */
export const PERMISSION_KEYS = [
  "tenant:manage",
  "user:manage",
  "form:create",
  "form:edit",
  "form:publish",
  "form:map",
  "submission:create",
  "submission:view",
  "submission:export",
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];

/**
 * Role hierarchy levels
 * Higher number = more permissions
 */
const ROLE_HIERARCHY = {
  OWNER: 4,
  ADMIN: 3,
  MANAGER: 2,
  AGENT: 1,
} as const;

export type SystemRole = keyof typeof ROLE_HIERARCHY;

const ROLE_PERMISSIONS: Record<SystemRole, PermissionKey[]> = {
  OWNER: [...PERMISSION_KEYS],
  ADMIN: [
    "tenant:manage",
    "user:manage",
    "form:create",
    "form:edit",
    "form:publish",
    "form:map",
    "submission:create",
    "submission:view",
    "submission:export",
  ],
  MANAGER: [
    "form:create",
    "form:edit",
    "form:publish",
    "form:map",
    "submission:create",
    "submission:view",
    "submission:export",
  ],
  AGENT: ["submission:create", "submission:view"],
};

/**
 * Get default member permissions
 * These permissions are hardcoded and available to all members by default
 * 
 * @returns Array of permission names
 */
async function getDefaultPermissionsForRole(role: SystemRole): Promise<string[]> {
  return [...(ROLE_PERMISSIONS[role] || [])];
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

  const membershipRole = (membership[0].role || "AGENT") as SystemRole;

  // 2. Owner has all permissions
  if (membershipRole === "OWNER") {
    return true;
  }

  // 3. System role permissions
  const systemPermissions = await getDefaultPermissionsForRole(membershipRole);
  if (systemPermissions.includes(permissionName as PermissionKey)) {
    return true;
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

  // 5. Check permissions from custom roles (additive)
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
    throw new Error(`Permissão negada: ${permissionName}`);
  }
}

/**
 * Check if a user has a specific role in an organization
 *
 * @param userId - User ID
 * @param orgId - Organization ID
 * @param roleName - Role name (OWNER, ADMIN, MANAGER, AGENT)
 * @returns true if user has the role, false otherwise
 */
export async function hasRole(
  userId: string,
  orgId: string,
  roleName: SystemRole
): Promise<boolean> {
  const db = await getDb();
  const membership = await db
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

  const userRole = (membership[0].role || "AGENT") as SystemRole;
  const userRoleLevel = ROLE_HIERARCHY[userRole as SystemRole] || 0;
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
