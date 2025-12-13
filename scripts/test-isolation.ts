/**
 * Basic isolation test script
 * 
 * This script tests basic multi-tenant isolation by:
 * 1. Creating test organizations
 * 2. Creating test memberships
 * 3. Verifying that users can only see their own organization's data
 * 
 * Run with: npx tsx scripts/test-isolation.ts
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
} from "../src/lib/schema";
import { eq, and, or } from "drizzle-orm";
import { randomUUID } from "crypto";

async function testIsolation() {
  console.log("🧪 Starting isolation tests...\n");

  try {
    // Create test users with unique IDs to avoid collisions
    // Using timestamp prefix ensures uniqueness even if UUIDs collide (extremely rare)
    const timestamp = Date.now();
    const user1Id = `test-${timestamp}-${randomUUID()}`;
    const user2Id = `test-${timestamp + 1}-${randomUUID()}`;

    console.log("📝 Creating test users...");
    await db.insert(user).values([
      {
        id: user1Id,
        name: "Test User 1",
        email: `test1-${Date.now()}@example.com`,
        emailVerified: true,
      },
      {
        id: user2Id,
        name: "Test User 2",
        email: `test2-${Date.now()}@example.com`,
        emailVerified: true,
      },
    ]);
    console.log("✅ Test users created\n");

    // Create test organizations with unique IDs
    const org1Id = `test-org-${timestamp}-${randomUUID()}`;
    const org2Id = `test-org-${timestamp + 1}-${randomUUID()}`;

    console.log("🏢 Creating test organizations...");
    await db.insert(organization).values([
      {
        id: org1Id,
        name: "Organization 1",
        slug: `org1-${Date.now()}`,
        createdBy: user1Id,
      },
      {
        id: org2Id,
        name: "Organization 2",
        slug: `org2-${Date.now()}`,
        createdBy: user2Id,
      },
    ]);
    console.log("✅ Test organizations created\n");

    // Create memberships
    console.log("👥 Creating memberships...");
    await db.insert(organizationMembership).values([
      {
        id: randomUUID(),
        organizationId: org1Id,
        userId: user1Id,
        role: "owner",
        status: "active",
      },
      {
        id: randomUUID(),
        organizationId: org2Id,
        userId: user2Id,
        role: "owner",
        status: "active",
      },
    ]);
    console.log("✅ Memberships created\n");

    // Test: User 1 should only see Organization 1
    console.log("🔍 Testing isolation for User 1...");
    const user1Orgs = await db
      .select({
        id: organization.id,
        name: organization.name,
      })
      .from(organization)
      .innerJoin(
        organizationMembership,
        eq(organization.id, organizationMembership.organizationId)
      )
      .where(
        and(
          eq(organizationMembership.userId, user1Id),
          eq(organizationMembership.status, "active")
        )
      );

    if (user1Orgs.length === 1 && user1Orgs[0]?.id === org1Id) {
      console.log("✅ User 1 can only see Organization 1\n");
    } else {
      console.error("❌ Isolation test failed for User 1");
      console.error("Expected: 1 organization (org1), Got:", user1Orgs);
      process.exit(1);
    }

    // Test: User 2 should only see Organization 2
    console.log("🔍 Testing isolation for User 2...");
    const user2Orgs = await db
      .select({
        id: organization.id,
        name: organization.name,
      })
      .from(organization)
      .innerJoin(
        organizationMembership,
        eq(organization.id, organizationMembership.organizationId)
      )
      .where(
        and(
          eq(organizationMembership.userId, user2Id),
          eq(organizationMembership.status, "active")
        )
      );

    if (user2Orgs.length === 1 && user2Orgs[0]?.id === org2Id) {
      console.log("✅ User 2 can only see Organization 2\n");
    } else {
      console.error("❌ Isolation test failed for User 2");
      console.error("Expected: 1 organization (org2), Got:", user2Orgs);
      process.exit(1);
    }

    // Cleanup
    console.log("🧹 Cleaning up test data...");
    await db
      .delete(organizationMembership)
      .where(
        or(
          eq(organizationMembership.organizationId, org1Id),
          eq(organizationMembership.organizationId, org2Id)
        )
      );
    await db
      .delete(organization)
      .where(or(eq(organization.id, org1Id), eq(organization.id, org2Id)));
    await db
      .delete(user)
      .where(or(eq(user.id, user1Id), eq(user.id, user2Id)));
    console.log("✅ Cleanup complete\n");

    console.log("🎉 All isolation tests passed!");
  } catch (error) {
    console.error("❌ Test failed with error:", error);
    process.exit(1);
  }
}

testIsolation();

