import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { organizationMembership } from "@/lib/schema";
import { SystemRole } from "./rbac";
import { resolveTenant } from "./tenant-resolver";

export type OrgAccessResult = {
  orgId: string;
  membership: typeof organizationMembership.$inferSelect;
  session: NonNullable<Awaited<ReturnType<typeof auth.api.getSession>>>;
};

/**
 * Requires organization access for the current request.
 * Validates that the user is authenticated and has access to the organization.
 *
 * @param req - The Next.js request object
 * @param requiredRole - Optional role requirement (OWNER, ADMIN, MANAGER, AGENT)
 * @returns Either an error response or the organization access result
 */
export async function requireOrgAccess(
  req: NextRequest,
  requiredRole?: SystemRole
): Promise<NextResponse | OrgAccessResult> {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const orgId = await resolveTenant(req);

  if (!orgId) {
    return NextResponse.json(
      { error: "Contexto de organização obrigatório" },
      { status: 400 }
    );
  }

  // Verificar membership com filtros explícitos
  const membership = await db
    .select()
    .from(organizationMembership)
    .where(
      and(
        eq(organizationMembership.organizationId, orgId),
        eq(organizationMembership.userId, session.user.id),
        eq(organizationMembership.status, "active")
      )
    )
    .limit(1);

  if (!membership[0]) {
    return NextResponse.json(
      { error: "Usuário não faz parte desta organização" },
      { status: 403 }
    );
  }

  // Verificar role se necessário
  if (requiredRole) {
    const roleHierarchy: Record<SystemRole, number> = {
      OWNER: 4,
      ADMIN: 3,
      MANAGER: 2,
      AGENT: 1,
    };
    const normalizedRole = (membership[0].role || "AGENT") as SystemRole;
    const userRoleLevel =
      roleHierarchy[normalizedRole] || 0;
    const requiredLevel = roleHierarchy[requiredRole];

    if (userRoleLevel < requiredLevel) {
      return NextResponse.json(
        { error: "Permissões insuficientes" },
        { status: 403 }
      );
    }
  }

  // NOTA: Não usar setOrgContext aqui - usar filtros explícitos
  // setOrgContext deve ser usado apenas dentro de transações com SET LOCAL

  return {
    orgId,
    membership: membership[0],
    session,
  };
}
