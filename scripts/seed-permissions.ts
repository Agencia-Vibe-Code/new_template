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

// Permissões padrão do sistema alinhadas ao app de formulário/PDF
const defaultPermissions = [
  {
    name: "tenant:manage",
    resource: "tenant",
    action: "manage",
    description: "Gerenciar tenant, domínios e isolamento",
  },
  {
    name: "user:manage",
    resource: "user",
    action: "manage",
    description: "Gerenciar membros, convites e papéis",
  },
  {
    name: "form:create",
    resource: "form",
    action: "create",
    description: "Criar novos modelos de formulário",
  },
  {
    name: "form:edit",
    resource: "form",
    action: "edit",
    description: "Editar campos e cópia dos modelos",
  },
  {
    name: "form:publish",
    resource: "form",
    action: "publish",
    description: "Publicar ou arquivar modelos",
  },
  {
    name: "form:map",
    resource: "form",
    action: "map",
    description: "Configurar coordenadas de campos no PDF base",
  },
  {
    name: "submission:create",
    resource: "submission",
    action: "create",
    description: "Preencher e salvar uma submissão",
  },
  {
    name: "submission:view",
    resource: "submission",
    action: "view",
    description: "Consultar submissões existentes",
  },
  {
    name: "submission:export",
    resource: "submission",
    action: "export",
    description: "Gerar PDF sobre o template original",
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
