import { headers } from "next/headers"
import { NextResponse } from "next/server"
import { eq } from "drizzle-orm"
import { auth, resolveOrCreateDefaultOrg } from "@/lib/auth"
import { db } from "@/lib/db"
import { user } from "@/lib/schema"

/**
 * POST /api/post-signin
 * 
 * Endpoint para ser chamado após sign-in bem-sucedido.
 * Define a organização padrão do usuário (lastActiveOrgId).
 * 
 * Este endpoint deve ser chamado pelo cliente após signIn() resolver.
 * 
 * @example
 * ```typescript
 * await authClient.signIn(credentials)
 * await fetch("/api/post-signin", { method: "POST", credentials: "include" })
 * ```
 */
export async function POST() {
  const session = await auth.api.getSession({ headers: await headers() })

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    // Resolver ou criar organização padrão
    const defaultOrg = await resolveOrCreateDefaultOrg(session.user.id)

    if (defaultOrg) {
      // Atualizar lastActiveOrgId no user record
      await db
        .update(user)
        .set({ lastActiveOrgId: defaultOrg.orgId })
        .where(eq(user.id, session.user.id))

      return NextResponse.json({
        success: true,
        organizationId: defaultOrg.orgId,
        role: defaultOrg.role,
      })
    }

    // Se nenhuma organização existir, retornar sucesso mas sem orgId
    // O cliente pode redirecionar para criação de organização
    return NextResponse.json({
      success: true,
      organizationId: null,
      message: "No organization found. User should create one.",
    })
  } catch (error) {
    console.error("[post-signin] Error resolving default org:", error)
    return NextResponse.json(
      { error: "Failed to resolve default organization" },
      { status: 500 }
    )
  }
}

