import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { eq, and } from "drizzle-orm"
import { db } from "./db"
import { getServerEnv } from "./env"
import { user, organizationMembership } from "./schema"

const env = getServerEnv()

/**
 * Helper para resolver ou criar organização padrão após sign-in.
 * Busca última organização ativa (lastActiveOrgId) ou primeira organização do usuário.
 * 
 * Esta função deve ser chamada após sign-in bem-sucedido para definir
 * a organização padrão do usuário.
 * 
 * @param userId - ID do usuário
 * @returns Objeto com orgId e role, ou null se nenhuma organização existir
 */
export async function resolveOrCreateDefaultOrg(userId: string) {
  // 1. Buscar última organização ativa (lastActiveOrgId)
  const userRecord = await db
    .select({ lastActiveOrgId: user.lastActiveOrgId })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1)

  if (userRecord[0]?.lastActiveOrgId) {
    const membership = await db
      .select({
        organizationId: organizationMembership.organizationId,
        role: organizationMembership.role,
      })
      .from(organizationMembership)
      .where(
        and(
          eq(organizationMembership.userId, userId),
          eq(
            organizationMembership.organizationId,
            userRecord[0].lastActiveOrgId
          ),
          eq(organizationMembership.status, "active")
        )
      )
      .limit(1)

    if (membership[0]) {
      return { orgId: membership[0].organizationId, role: membership[0].role }
    }
  }

  // 2. Buscar primeira organização do usuário
  const firstMembership = await db
    .select({
      organizationId: organizationMembership.organizationId,
      role: organizationMembership.role,
    })
    .from(organizationMembership)
    .where(
      and(
        eq(organizationMembership.userId, userId),
        eq(organizationMembership.status, "active")
      )
    )
    .limit(1)

  if (firstMembership[0]) {
    // Atualizar lastActiveOrgId com a primeira organização encontrada
    await db
      .update(user)
      .set({ lastActiveOrgId: firstMembership[0].organizationId })
      .where(eq(user.id, userId))

    return {
      orgId: firstMembership[0].organizationId,
      role: firstMembership[0].role,
    }
  }

  // 3. Se nenhuma organização existir, retornar null
  // A criação de organização padrão será feita quando necessário (ex: primeiro acesso ao dashboard)
  return null
}

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
  }),
  socialProviders: env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
    ? {
        google: {
          clientId: env.GOOGLE_CLIENT_ID,
          clientSecret: env.GOOGLE_CLIENT_SECRET,
        },
      }
    : undefined,
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 dias
    updateAge: 60 * 60 * 24, // Atualizar a cada 24h
  },
  // Nota sobre hooks do Better Auth:
  // Hooks nativos do Better Auth não estão disponíveis nesta versão.
  // A lógica de definir lastActiveOrgId após sign-in é implementada via:
  // 1. Endpoint POST /api/post-signin - chamado pelo cliente após signIn()
  // 2. Função resolveOrCreateDefaultOrg() - exportada para uso em outros contextos
  // 3. Endpoint de switch de organização - atualiza lastActiveOrgId ao trocar de org
  // 
  // Ver: src/app/api/post-signin/route.ts para implementação completa
  // Ver: docs/technical/betterauth/fase2-correcoes.md para contexto e decisões de design
})