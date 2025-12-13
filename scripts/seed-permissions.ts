#!/usr/bin/env tsx
/**
 * Seed script for default permissions
 * 
 * This script populates the permission table with default system permissions.
 * Run with: pnpm run db:seed:permissions
 */

// Load environment variables from .env.local before importing db
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { randomUUID } from "crypto";

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

type SeedDependencies = {
  db: typeof import("../src/lib/db")["db"];
  permission: typeof import("../src/lib/schema")["permission"];
  eq: typeof import("drizzle-orm")["eq"];
};

// Permissões padrão do sistema
const defaultPermissions = [
  // Organization
  {
    name: "organization:read",
    resource: "organization",
    action: "read",
    description: "Read organization details",
  },
  {
    name: "organization:update",
    resource: "organization",
    action: "update",
    description: "Update organization settings",
  },
  {
    name: "organization:delete",
    resource: "organization",
    action: "delete",
    description: "Delete organization (owner only)",
  },
  {
    name: "organization:transfer",
    resource: "organization",
    action: "transfer",
    description: "Transfer organization ownership (owner only)",
  },

  // Members
  {
    name: "member:read",
    resource: "member",
    action: "read",
    description: "View organization members",
  },
  {
    name: "member:invite",
    resource: "member",
    action: "invite",
    description: "Invite new members to organization",
  },
  {
    name: "member:update",
    resource: "member",
    action: "update",
    description: "Update member roles and status",
  },
  {
    name: "member:remove",
    resource: "member",
    action: "remove",
    description: "Remove members from organization",
  },

  // Projects (exemplo)
  {
    name: "project:create",
    resource: "project",
    action: "create",
    description: "Create new projects",
  },
  {
    name: "project:read",
    resource: "project",
    action: "read",
    description: "View projects",
  },
  {
    name: "project:update",
    resource: "project",
    action: "update",
    description: "Update project details",
  },
  {
    name: "project:delete",
    resource: "project",
    action: "delete",
    description: "Delete projects",
  },

  // Users
  {
    name: "user:read",
    resource: "user",
    action: "read",
    description: "View user profiles",
  },
  {
    name: "user:update",
    resource: "user",
    action: "update",
    description: "Update user profiles",
  },

  // Roles (para RBAC customizado)
  {
    name: "role:create",
    resource: "role",
    action: "create",
    description: "Create custom roles",
  },
  {
    name: "role:read",
    resource: "role",
    action: "read",
    description: "View roles",
  },
  {
    name: "role:update",
    resource: "role",
    action: "update",
    description: "Update role permissions",
  },
  {
    name: "role:delete",
    resource: "role",
    action: "delete",
    description: "Delete custom roles",
  },
];

async function seedPermissions({ db, permission, eq }: SeedDependencies) {
  console.log("🌱 Seeding default permissions...\n");

  let created = 0;
  let skipped = 0;

  for (const perm of defaultPermissions) {
    // Verificar se permissão já existe
    const existing = await db
      .select()
      .from(permission)
      .where(eq(permission.name, perm.name))
      .limit(1);

    if (existing.length > 0) {
      console.log(`⏭️  Skipping ${perm.name} (already exists)`);
      skipped++;
      continue;
    }

    // Criar permissão
    await db.insert(permission).values({
      id: randomUUID(),
      name: perm.name,
      resource: perm.resource,
      action: perm.action,
      description: perm.description,
    });

    console.log(`✅ Created ${perm.name}`);
    created++;
  }

  console.log(`\n✨ Seed completed!`);
  console.log(`   Created: ${created}`);
  console.log(`   Skipped: ${skipped}`);
  console.log(`   Total: ${defaultPermissions.length}`);
}

async function main() {
  const [{ db }, { permission }, { eq }] = await Promise.all([
    import("../src/lib/db"),
    import("../src/lib/schema"),
    import("drizzle-orm"),
  ]);

  await seedPermissions({ db, permission, eq });
}

// Executar seed
main()
  .then(() => {
    console.log("\n✅ Permissions seeded successfully!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Error seeding permissions:", error);
    process.exit(1);
  });
