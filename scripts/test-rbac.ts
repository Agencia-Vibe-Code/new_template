/**
 * Basic RBAC authorization test script
 * 
 * This script tests the RBAC system by:
 * 1. Creating test users and organizations
 * 2. Creating memberships with different roles
 * 3. Testing permission checks for each role
 * 4. Testing role hierarchy
 * 
 * Run with: npx tsx scripts/test-rbac.ts
 */

// Load environment variables from .env.local before importing db
import { existsSync, readFileSync } from "fs";
import { join } from "path";

const envFile = join(process.cwd(), ".env.local");
if (existsSync(envFile)) {
  const envContent = readFileSync(envFile, "utf-8");
  envContent.split("\n").forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const [key, ...valueParts] = trimmed.split("=");
      if (key && valueParts.length > 0) {
        const value = valueParts.join("=").trim();
        // Remove quotes if present
        const cleanValue = value.replace(/^["']|["']$/g, "");
        if (!process.env[key]) {
          process.env[key] = cleanValue;
        }
      }
    }
  });
}

import { db } from "../src/lib/db";
import {
  organization,
  organizationMembership,
  user,
  permission,
} from "../src/lib/schema";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import {
  hasPermission,
  requirePermission,
  hasRole,
  hasMinimumRole,
  getUserRole,
} from "../src/lib/rbac";

async function testRBAC() {
  console.log("🧪 Starting RBAC authorization tests...\n");

  try {
    const timestamp = Date.now();

    // Create test users
    console.log("📝 Creating test users...");
    const ownerId = `test-owner-${timestamp}-${randomUUID()}`;
    const adminId = `test-admin-${timestamp}-${randomUUID()}`;
    const memberId = `test-member-${timestamp}-${randomUUID()}`;

    await db.insert(user).values([
      {
        id: ownerId,
        name: "Test Owner",
        email: `owner-${timestamp}@example.com`,
        emailVerified: true,
      },
      {
        id: adminId,
        name: "Test Admin",
        email: `admin-${timestamp}@example.com`,
        emailVerified: true,
      },
      {
        id: memberId,
        name: "Test Member",
        email: `member-${timestamp}@example.com`,
        emailVerified: true,
      },
    ]);
    console.log("✅ Test users created\n");

    // Create test organization
    console.log("🏢 Creating test organization...");
    const orgId = `test-org-${timestamp}-${randomUUID()}`;
    await db.insert(organization).values({
      id: orgId,
      name: "Test Organization",
      slug: `test-org-${timestamp}`,
      createdBy: ownerId,
    });
    console.log("✅ Test organization created\n");

    // Create memberships with different roles
    console.log("👥 Creating memberships...");
    await db.insert(organizationMembership).values([
      {
        id: randomUUID(),
        organizationId: orgId,
        userId: ownerId,
        role: "owner",
        status: "active",
      },
      {
        id: randomUUID(),
        organizationId: orgId,
        userId: adminId,
        role: "admin",
        status: "active",
      },
      {
        id: randomUUID(),
        organizationId: orgId,
        userId: memberId,
        role: "member",
        status: "active",
      },
    ]);
    console.log("✅ Memberships created\n");

    // Seed permissions if they don't exist
    console.log("🔐 Checking permissions...");
    const testPermissions = [
      { name: "project:read", resource: "project", action: "read" },
      { name: "project:create", resource: "project", action: "create" },
      { name: "organization:delete", resource: "organization", action: "delete" },
      { name: "organization:transfer", resource: "organization", action: "transfer" },
    ];

    for (const perm of testPermissions) {
      const existing = await db
        .select()
        .from(permission)
        .where(eq(permission.name, perm.name))
        .limit(1);

      if (existing.length === 0) {
        await db.insert(permission).values({
          id: randomUUID(),
          name: perm.name,
          resource: perm.resource,
          action: perm.action,
        });
        console.log(`   ✅ Created permission: ${perm.name}`);
      }
    }
    console.log("✅ Permissions ready\n");

    // Test 1: Owner has all permissions
    console.log("🧪 Test 1: Owner permissions");
    const ownerCanRead = await hasPermission(ownerId, orgId, "project:read");
    const ownerCanDelete = await hasPermission(ownerId, orgId, "organization:delete");
    console.log(`   Owner can read projects: ${ownerCanRead ? "✅" : "❌"}`);
    console.log(`   Owner can delete org: ${ownerCanDelete ? "✅" : "❌"}`);
    if (!ownerCanRead || !ownerCanDelete) {
      throw new Error("Owner should have all permissions");
    }
    console.log("✅ Test 1 passed\n");

    // Test 2: Admin has most permissions but not critical ones
    console.log("🧪 Test 2: Admin permissions");
    const adminCanRead = await hasPermission(adminId, orgId, "project:read");
    const adminCanCreate = await hasPermission(adminId, orgId, "project:create");
    const adminCanDelete = await hasPermission(adminId, orgId, "organization:delete");
    const adminCanTransfer = await hasPermission(adminId, orgId, "organization:transfer");
    console.log(`   Admin can read projects: ${adminCanRead ? "✅" : "❌"}`);
    console.log(`   Admin can create projects: ${adminCanCreate ? "✅" : "❌"}`);
    console.log(`   Admin can delete org: ${adminCanDelete ? "❌ (expected)" : "✅"}`);
    console.log(`   Admin can transfer org: ${adminCanTransfer ? "❌ (expected)" : "✅"}`);
    if (!adminCanRead || !adminCanCreate || adminCanDelete || adminCanTransfer) {
      throw new Error("Admin should have most permissions but not critical ones");
    }
    console.log("✅ Test 2 passed\n");

    // Test 3: Member has default permissions
    console.log("🧪 Test 3: Member default permissions");
    const memberCanRead = await hasPermission(memberId, orgId, "project:read");
    const memberCanCreate = await hasPermission(memberId, orgId, "project:create");
    const memberCanDelete = await hasPermission(memberId, orgId, "organization:delete");
    console.log(`   Member can read projects: ${memberCanRead ? "✅" : "❌"}`);
    console.log(`   Member can create projects: ${memberCanCreate ? "✅" : "❌"}`);
    console.log(`   Member can delete org: ${memberCanDelete ? "❌ (expected)" : "✅"}`);
    if (!memberCanRead || !memberCanCreate || memberCanDelete) {
      throw new Error("Member should have default permissions but not critical ones");
    }
    console.log("✅ Test 3 passed\n");

    // Test 4: Role hierarchy
    console.log("🧪 Test 4: Role hierarchy");
    const ownerHasMinAdmin = await hasMinimumRole(ownerId, orgId, "admin");
    const adminHasMinMember = await hasMinimumRole(adminId, orgId, "member");
    const memberHasMinAdmin = await hasMinimumRole(memberId, orgId, "admin");
    console.log(`   Owner >= Admin: ${ownerHasMinAdmin ? "✅" : "❌"}`);
    console.log(`   Admin >= Member: ${adminHasMinMember ? "✅" : "❌"}`);
    console.log(`   Member >= Admin: ${memberHasMinAdmin ? "❌ (expected)" : "✅"}`);
    if (!ownerHasMinAdmin || !adminHasMinMember || memberHasMinAdmin) {
      throw new Error("Role hierarchy not working correctly");
    }
    console.log("✅ Test 4 passed\n");

    // Test 5: Role checks
    console.log("🧪 Test 5: Role checks");
    const ownerIsOwner = await hasRole(ownerId, orgId, "owner");
    const adminIsAdmin = await hasRole(adminId, orgId, "admin");
    const memberIsMember = await hasRole(memberId, orgId, "member");
    console.log(`   Owner is owner: ${ownerIsOwner ? "✅" : "❌"}`);
    console.log(`   Admin is admin: ${adminIsAdmin ? "✅" : "❌"}`);
    console.log(`   Member is member: ${memberIsMember ? "✅" : "❌"}`);
    if (!ownerIsOwner || !adminIsAdmin || !memberIsMember) {
      throw new Error("Role checks not working correctly");
    }
    console.log("✅ Test 5 passed\n");

    // Test 6: requirePermission throws on denied
    console.log("🧪 Test 6: requirePermission error handling");
    try {
      await requirePermission(memberId, orgId, "organization:delete");
      throw new Error("requirePermission should throw for denied permission");
    } catch (error) {
      if (error instanceof Error && error.message.includes("Permission denied")) {
        console.log("   ✅ requirePermission throws correctly: ✅");
      } else {
        throw error;
      }
    }
    console.log("✅ Test 6 passed\n");

    // Test 7: getUserRole
    console.log("🧪 Test 7: getUserRole");
    const ownerRole = await getUserRole(ownerId, orgId);
    const adminRole = await getUserRole(adminId, orgId);
    const memberRole = await getUserRole(memberId, orgId);
    console.log(`   Owner role: ${ownerRole === "owner" ? "✅" : "❌"}`);
    console.log(`   Admin role: ${adminRole === "admin" ? "✅" : "❌"}`);
    console.log(`   Member role: ${memberRole === "member" ? "✅" : "❌"}`);
    if (ownerRole !== "owner" || adminRole !== "admin" || memberRole !== "member") {
      throw new Error("getUserRole not working correctly");
    }
    console.log("✅ Test 7 passed\n");

    console.log("✨ All RBAC tests passed!\n");

    // Cleanup (optional - comment out to keep test data)
    console.log("🧹 Cleaning up test data...");
    await db.delete(organizationMembership).where(eq(organizationMembership.organizationId, orgId));
    await db.delete(organization).where(eq(organization.id, orgId));
    await db.delete(user).where(eq(user.id, ownerId));
    await db.delete(user).where(eq(user.id, adminId));
    await db.delete(user).where(eq(user.id, memberId));
    console.log("✅ Cleanup completed\n");
  } catch (error) {
    console.error("\n❌ Test failed:", error);
    if (error instanceof Error) {
      console.error("   Error message:", error.message);
      console.error("   Stack:", error.stack);
    }
    process.exit(1);
  }
}

// Run tests
testRBAC()
  .then(() => {
    console.log("✅ All tests completed successfully!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Test execution failed:", error);
    process.exit(1);
  });

